"""Unit + integration tests for the HTTP conditional-GET cache.

Covers the store/serve unit (validators, body round-trip, no-validator skip, LRU
eviction, disabled mode) and the fetch() integration (304 replay off the AIRAC
change window; fresh fetch inside it).
"""

from __future__ import annotations

from pathlib import Path

import httpx

from crawlers import http_base, http_cache
from crawlers.http_base import HttpCrawlerBase
from crawlers.http_cache import ConditionalCache


def _cache(tmp_path: Path, max_bytes: int = 10 * 1024 * 1024) -> ConditionalCache:
    return ConditionalCache(tmp_path / "cache.sqlite", max_bytes)


# ----- store / serve unit -----------------------------------------------------


def test_store_then_conditional_headers(tmp_path):
    c = _cache(tmp_path)
    c.store(
        "https://x/y",
        etag='"abc"',
        last_modified="Wed, 01 Jul 2026 00:00:00 GMT",
        content=b"<html>hi</html>",
        encoding="utf-8",
    )
    assert c.conditional_headers("https://x/y") == {
        "If-None-Match": '"abc"',
        "If-Modified-Since": "Wed, 01 Jul 2026 00:00:00 GMT",
    }


def test_body_round_trip(tmp_path):
    c = _cache(tmp_path)
    c.store("u", etag='"e"', last_modified=None, content=b"body-bytes", encoding="latin-1")
    body, enc = c.load_body("u")
    assert body == b"body-bytes"
    assert enc == "latin-1"


def test_no_validator_is_not_stored(tmp_path):
    c = _cache(tmp_path)
    c.store("u", etag=None, last_modified=None, content=b"x", encoding="utf-8")
    # Nothing to revalidate against later -> nothing stored.
    assert c.conditional_headers("u") == {}
    assert c.load_body("u") is None


def test_lru_eviction_drops_oldest(tmp_path):
    # Cap tiny so a few KB-sized bodies force eviction; gzip of random-ish bytes
    # keeps them from collapsing to nothing.
    c = _cache(tmp_path, max_bytes=1500)
    for i in range(6):
        c.store(
            f"u{i}",
            etag=f'"{i}"',
            last_modified=None,
            content=bytes((i * 7 + j) % 256 for j in range(1000)),
            encoding="utf-8",
        )
    # The most recent entry must survive; the oldest must be gone.
    assert c.load_body("u5") is not None
    assert c.load_body("u0") is None


def test_missing_url_has_no_headers_and_no_body(tmp_path):
    c = _cache(tmp_path)
    assert c.conditional_headers("nope") == {}
    assert c.load_body("nope") is None


def test_disabled_cache_env(monkeypatch, tmp_path):
    monkeypatch.setenv("CRAWLER_NO_HTTP_CACHE", "1")
    http_cache.reset_shared_cache()
    cache = http_cache.get_shared_cache()
    assert cache.enabled is False
    assert cache.conditional_headers("u") == {}


# ----- fetch() integration ----------------------------------------------------


class _Concrete(HttpCrawlerBase):
    def crawl(self):  # pragma: no cover
        return []


def _enable_real_cache(monkeypatch, tmp_path):
    monkeypatch.delenv("CRAWLER_NO_HTTP_CACHE", raising=False)
    monkeypatch.setenv("CRAWLER_HTTP_CACHE_DIR", str(tmp_path))
    http_cache.reset_shared_cache()


def test_304_replays_cached_body_off_change_window(monkeypatch, tmp_path):
    _enable_real_cache(monkeypatch, tmp_path)
    # Force "not a change window" so conditional requests are trusted.
    monkeypatch.setattr(http_base, "in_airac_change_window", lambda *_: False)

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if request.headers.get("If-None-Match") == '"v1"':
            return httpx.Response(304)
        return httpx.Response(
            200,
            headers={"ETag": '"v1"', "Content-Type": "text/html"},
            text="<p>fresh</p>",
        )

    c = _Concrete("xx")
    c.client = httpx.Client(transport=httpx.MockTransport(handler), timeout=2.0)
    try:
        # First fetch: 200, body stored with the ETag.
        assert c.fetch("https://eaip.test/p.html") == "<p>fresh</p>"
        # Second fetch: server 304s -> the cached body is replayed.
        assert c.fetch("https://eaip.test/p.html") == "<p>fresh</p>"
    finally:
        c.close()
    assert calls["n"] == 2  # both requests were made; the 2nd got a 304


def test_change_window_forces_fresh_fetch(monkeypatch, tmp_path):
    _enable_real_cache(monkeypatch, tmp_path)
    # Inside a change window: no conditional header is sent, so no 304.
    monkeypatch.setattr(http_base, "in_airac_change_window", lambda *_: True)

    seen_conditional = {"any": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if "If-None-Match" in request.headers:
            seen_conditional["any"] = True
        return httpx.Response(
            200,
            headers={"ETag": '"v1"', "Content-Type": "text/html"},
            text="<p>edition-2</p>",
        )

    c = _Concrete("xx")
    c.client = httpx.Client(transport=httpx.MockTransport(handler), timeout=2.0)
    try:
        assert c.fetch("https://eaip.test/p.html") == "<p>edition-2</p>"
        assert c.fetch("https://eaip.test/p.html") == "<p>edition-2</p>"
    finally:
        c.close()
    assert seen_conditional["any"] is False  # never sent a validator in-window
