"""Unit tests for the crawl-outcome -> health-metric mapping."""

from __future__ import annotations

import json

from health.crawl_report import CrawlReport, build_crawl_metrics


def _index(rows):
    """(scope, metric) -> row dict."""
    return {(r["scope"], r["metric"]): r for r in rows}


def test_successful_crawl_metrics():
    reports = [CrawlReport("de", published=True, count=200, pdf_count=0, duration_s=3.456)]
    rows = build_crawl_metrics(reports, recorded_at=1000)
    idx = _index(rows)
    assert idx[("DE", "crawl_ok")]["value"] == 1.0
    assert idx[("DE", "crawl_ok")]["status"] == "ok"
    assert idx[("DE", "crawl_airport_count")]["value"] == 200
    assert idx[("DE", "crawl_pdf_count")]["value"] == 0
    assert idx[("DE", "crawl_duration_s")]["value"] == 3.46  # rounded
    assert idx[("DE", "crawl_duration_s")]["unit"] == "s"
    # All rows share the run timestamp + category.
    assert all(r["recordedAt"] == 1000 and r["category"] == "crawl" for r in rows)


def test_failed_crawl_is_crit_with_reason():
    reports = [CrawlReport("fr", published=False, reason="crawl-error", duration_s=1.0)]
    rows = build_crawl_metrics(reports, recorded_at=500)
    idx = _index(rows)
    ok = idx[("FR", "crawl_ok")]
    assert ok["value"] == 0.0
    assert ok["status"] == "crit"
    # reason is carried in meta (JSON-encoded).
    assert json.loads(ok["meta"]) == {"reason": "crawl-error"}


def test_published_but_empty_is_warn():
    reports = [CrawlReport("xk", published=True, count=0, pdf_count=0)]
    rows = build_crawl_metrics(reports, recorded_at=1)
    assert _index(rows)[("XK", "crawl_ok")]["status"] == "warn"


def test_multiple_countries_scoped_uppercase():
    reports = [
        CrawlReport("de", published=True, count=10),
        CrawlReport("at", published=False, reason="drop-guard-abort", count=3),
    ]
    rows = build_crawl_metrics(reports, recorded_at=42)
    scopes = {r["scope"] for r in rows}
    assert scopes == {"DE", "AT"}
    # 4 metrics per country.
    assert len(rows) == 8


def test_empty_reports_yield_no_rows():
    assert build_crawl_metrics([], recorded_at=1) == []
