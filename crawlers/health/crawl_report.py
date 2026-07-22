"""Per-country crawl outcome -> health metrics (category "crawl").

Lives in the health package so the model + the pure metric builder sit together
and can be unit-tested without a network (like cloudflare_parse). The crawler's
`OutputHandler` fills a `CrawlReport` per country during a run and POSTs the
built metrics to `/api/health` at the end. Fully fail-soft on the POST side (see
OutputHandler.publish_crawl_health) - health reporting must never affect a crawl.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .models import Metric


@dataclass
class CrawlReport:
    """The outcome of one country's crawl+publish."""

    country: str
    published: bool  # did the airports POST actually succeed?
    count: int = 0  # airports published (post-sanitize)
    pdf_count: int = 0  # of those, how many carry a direct chart PDF
    reason: Optional[str] = None  # why not published (e.g. "drop-guard-abort")
    duration_s: float = 0.0  # crawl() wall time, filled by main.py


def _status(r: CrawlReport) -> str:
    """ok = published with data; warn = published but empty; crit = not published."""
    if not r.published:
        return "crit"
    return "ok" if r.count > 0 else "warn"


def build_crawl_metrics(reports: list[CrawlReport], recorded_at: int) -> list[dict]:
    """Map each country's CrawlReport to health-metric payloads (category
    "crawl", scope = country). All rows of one run share `recorded_at`."""
    out: list[dict] = []
    for r in reports:
        scope = r.country.upper()
        status = _status(r)
        meta = {"reason": r.reason} if r.reason else None
        metrics = [
            Metric("crawl", "crawl_ok", 1.0 if r.published else 0.0, "count", scope=scope, status=status, meta=meta),
            Metric("crawl", "crawl_airport_count", float(r.count), "count", scope=scope),
            Metric("crawl", "crawl_pdf_count", float(r.pdf_count), "count", scope=scope),
            Metric("crawl", "crawl_duration_s", round(r.duration_s, 2), "s", scope=scope),
        ]
        for m in metrics:
            m.recorded_at = recorded_at
            out.append(m.to_payload())
    return out
