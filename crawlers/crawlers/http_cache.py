"""Persistent conditional-GET cache for the crawler HTTP layer.

Stores each fetched HTML page's HTTP validators (ETag / Last-Modified) and body,
so a later run can send ``If-None-Match`` / ``If-Modified-Since`` and, on a
**304 Not Modified**, replay the stored body instead of re-downloading it. The
AIP content upstream is static between AIRAC effective dates, so on the weekly
safety run (and manual mid-cycle re-runs) the vast majority of pages 304 - the
transfer of thousands of unchanged navigation / AD-2.3 pages is skipped.

Design:

- One **SQLite** file (stdlib ``sqlite3``, no third-party deps), bodies stored
  **gzip-compressed**, an **LRU size cap** (oldest ``stored_at`` evicted first).
- **Fully fail-soft.** Any error - unwritable dir, sqlite failure, corrupt row -
  degrades to "no cache" (a normal 200 fetch), never raising into a crawl.
- **Kill switch:** ``CRAWLER_NO_HTTP_CACHE=1`` disables it entirely.
- Tunable: ``CRAWLER_HTTP_CACHE_DIR`` (default ``http_cache/``),
  ``CRAWLER_HTTP_CACHE_MAX_MB`` (default 250).

Correctness note: the *caller* (``HttpCrawlerBase.fetch``) decides WHEN to trust
a 304 - it does not send conditional headers on an AIRAC change-window day (see
``airac.in_airac_change_window``), so a late edition flip is never masked by a
stale cached body. This module only stores/serves; it makes no freshness policy.

Cross-run persistence on the ephemeral Actions runner is via ``actions/cache``
(see ``.github/workflows/crawl.yml``), the same mechanism as
``last_run_counts.json``.
"""

from __future__ import annotations

import gzip
import logging
import os
import sqlite3
import time
from pathlib import Path

_DEFAULT_DIR = "http_cache"
_DEFAULT_MAX_MB = 250


class ConditionalCache:
    """SQLite-backed ETag/Last-Modified + body store. All methods are fail-soft."""

    def __init__(
        self,
        path: Path,
        max_bytes: int,
        logger: logging.Logger | None = None,
    ) -> None:
        self.logger = logger or logging.getLogger(__name__)
        self.max_bytes = max_bytes
        self._conn: sqlite3.Connection | None = None
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(str(path))
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pages (
                    url           TEXT PRIMARY KEY,
                    etag          TEXT,
                    last_modified TEXT,
                    encoding      TEXT,
                    body          BLOB,
                    bytes         INTEGER,
                    stored_at     INTEGER
                )
                """
            )
            self._conn.commit()
        except Exception as e:  # unwritable / locked -> run without a cache
            self.logger.warning(f"HTTP cache disabled (init failed: {e})")
            self._safe_close()
            self._conn = None

    @property
    def enabled(self) -> bool:
        return self._conn is not None

    def conditional_headers(self, url: str) -> dict[str, str]:
        """Return {If-None-Match / If-Modified-Since} for a cached URL, or {}."""
        if self._conn is None:
            return {}
        try:
            row = self._conn.execute(
                "SELECT etag, last_modified FROM pages WHERE url = ?", (url,)
            ).fetchone()
        except Exception as e:
            self.logger.debug(f"HTTP cache read (headers) failed for {url}: {e}")
            return {}
        if not row:
            return {}
        etag, last_modified = row
        headers: dict[str, str] = {}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified
        return headers

    def load_body(self, url: str) -> tuple[bytes, str] | None:
        """Return (decompressed body bytes, stored encoding) for a 304 replay,
        or None if absent/unreadable."""
        if self._conn is None:
            return None
        try:
            row = self._conn.execute(
                "SELECT body, encoding FROM pages WHERE url = ?", (url,)
            ).fetchone()
            if not row or row[0] is None:
                return None
            return gzip.decompress(row[0]), (row[1] or "utf-8")
        except Exception as e:
            self.logger.debug(f"HTTP cache read (body) failed for {url}: {e}")
            return None

    def store(
        self,
        url: str,
        *,
        etag: str | None,
        last_modified: str | None,
        content: bytes,
        encoding: str | None,
    ) -> None:
        """Upsert a page's validators + gzip'd body, then enforce the size cap.
        Only worth storing when the server gave us a validator to revalidate
        against later; otherwise a future request could never get a 304."""
        if self._conn is None:
            return
        if not etag and not last_modified:
            return  # no validator -> a stored body could never be revalidated
        try:
            blob = gzip.compress(content)
            self._conn.execute(
                """
                INSERT INTO pages (url, etag, last_modified, encoding, body,
                                   bytes, stored_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    etag=excluded.etag,
                    last_modified=excluded.last_modified,
                    encoding=excluded.encoding,
                    body=excluded.body,
                    bytes=excluded.bytes,
                    stored_at=excluded.stored_at
                """,
                (
                    url,
                    etag,
                    last_modified,
                    encoding or "utf-8",
                    blob,
                    len(blob),
                    int(time.time()),
                ),
            )
            self._conn.commit()
            self._enforce_cap()
        except Exception as e:
            self.logger.debug(f"HTTP cache write failed for {url}: {e}")

    def _enforce_cap(self) -> None:
        """Evict the oldest rows (by stored_at) until total bytes <= max_bytes."""
        if self._conn is None:
            return
        try:
            while (
                self._conn.execute(
                    "SELECT COALESCE(SUM(bytes), 0) FROM pages"
                ).fetchone()[0]
                > self.max_bytes
            ):
                victim = self._conn.execute(
                    "SELECT url FROM pages ORDER BY stored_at ASC, rowid ASC LIMIT 1"
                ).fetchone()
                if not victim:
                    break
                self._conn.execute("DELETE FROM pages WHERE url = ?", (victim[0],))
            self._conn.commit()
        except Exception as e:
            self.logger.debug(f"HTTP cache cap enforcement failed: {e}")

    def _safe_close(self) -> None:
        try:
            if self._conn is not None:
                self._conn.close()
        except Exception:
            pass

    def close(self) -> None:
        self._safe_close()
        self._conn = None


class _DisabledCache:
    """No-op cache used when CRAWLER_NO_HTTP_CACHE is set."""

    enabled = False

    def conditional_headers(self, url: str) -> dict[str, str]:
        return {}

    def load_body(self, url: str):
        return None

    def store(self, *args, **kwargs) -> None:
        pass

    def close(self) -> None:
        pass


# One shared cache per process. main.py runs crawlers sequentially in a single
# process/thread, so a single sqlite connection is the efficient, safe choice.
_shared: ConditionalCache | _DisabledCache | None = None


def get_shared_cache(
    logger: logging.Logger | None = None,
) -> ConditionalCache | _DisabledCache:
    """Return the process-wide conditional cache, lazily initialised on first
    use (so importing / instantiating a crawler with no fetch never touches the
    filesystem - keeps the unit tests cache-free)."""
    global _shared
    if _shared is not None:
        return _shared
    if os.environ.get("CRAWLER_NO_HTTP_CACHE"):
        _shared = _DisabledCache()
        return _shared
    cache_dir = os.environ.get("CRAWLER_HTTP_CACHE_DIR", _DEFAULT_DIR)
    try:
        max_mb = int(os.environ.get("CRAWLER_HTTP_CACHE_MAX_MB", _DEFAULT_MAX_MB))
    except ValueError:
        max_mb = _DEFAULT_MAX_MB
    _shared = ConditionalCache(
        Path(cache_dir) / "cache.sqlite", max_mb * 1024 * 1024, logger
    )
    return _shared


def reset_shared_cache() -> None:
    """Drop the process-wide cache singleton (used by tests for isolation)."""
    global _shared
    if _shared is not None:
        _shared.close()
    _shared = None
