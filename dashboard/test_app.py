"""Local tests for the dashboard's pure helpers (group_series, sparkline_svg).

Not part of the crawler CI (the dashboard is a standalone app); run manually:
    cd dashboard && uv run --with fastapi --with httpx pytest test_app.py
"""

from __future__ import annotations

import app


def test_group_series_orders_and_takes_latest():
    rows = [
        # newest-first, as the API returns them
        {"category": "server", "metric": "ram_used_pct", "scope": None, "unit": "pct", "status": "ok", "value": 42, "recordedAt": 300},
        {"category": "server", "metric": "ram_used_pct", "scope": None, "unit": "pct", "status": "ok", "value": 40, "recordedAt": 200},
        {"category": "server", "metric": "ram_used_pct", "scope": None, "unit": "pct", "status": "ok", "value": 38, "recordedAt": 100},
    ]
    by_cat = app.group_series(rows)
    assert "server" in by_cat
    s = by_cat["server"][0]
    assert s["metric"] == "ram_used_pct"
    assert s["value"] == 42  # latest (highest recordedAt)
    assert s["points"] == [38.0, 40.0, 42.0]  # ascending by time


def test_group_series_splits_by_scope():
    rows = [
        {"category": "crawl", "metric": "crawl_ok", "scope": "DE", "value": 1, "recordedAt": 1, "status": "ok"},
        {"category": "crawl", "metric": "crawl_ok", "scope": "FR", "value": 0, "recordedAt": 1, "status": "crit"},
    ]
    series = app.group_series(rows)["crawl"]
    scopes = {s["scope"] for s in series}
    assert scopes == {"DE", "FR"}


def test_sparkline_empty_and_single():
    assert app.sparkline_svg([]) == ""
    one = app.sparkline_svg([5.0], status="ok")
    assert one.startswith("<svg") and "<circle" in one


def test_sparkline_multi_has_polyline_and_dot():
    svg = app.sparkline_svg([1.0, 3.0, 2.0, 5.0], status="warn")
    assert "<polyline" in svg and "points=" in svg and "<circle" in svg
    # warn -> amber stroke
    assert "#9a6700" in svg


def test_sparkline_flat_series_is_midline():
    # constant series must not divide-by-zero; renders a flat line at mid-height
    svg = app.sparkline_svg([7.0, 7.0, 7.0])
    assert "<polyline" in svg
    assert "12.0" in svg  # height 24 -> mid 12


def test_fmt_bytes_and_units():
    assert app._fmt(1536, "bytes") == "1.5 KB"
    assert app._fmt(42, "pct") == "42 %"
    assert app._fmt(3.5, "s") == "3.5 s"
    assert app._fmt(None, "count") == "-"


def _series(status, category="server", metric="m", scope=None):
    return {
        "metric": metric,
        "scope": scope,
        "unit": None,
        "status": status,
        "value": 1,
        "points": [1.0],
    }


def test_summarize_counts_and_worst():
    by_cat = {
        "server": [_series("ok"), _series("warn", metric="load")],
        "crawl": [_series("crit", category="crawl", metric="crawl_ok", scope="FR")],
    }
    s = app.summarize(by_cat)
    assert s["counts"] == {"crit": 1, "warn": 1, "ok": 1}
    assert s["worst"] == "crit"
    assert s["crit"] == ["crawl/crawl_ok/FR"]


def test_summarize_all_ok():
    s = app.summarize({"server": [_series("ok"), _series("ok", metric="disk")]})
    assert s["worst"] == "ok"
    assert s["counts"]["ok"] == 2
    assert s["crit"] == []


def test_summarize_ignores_statusless_series():
    s = app.summarize({"database": [_series(None)]})
    assert s["counts"] == {"crit": 0, "warn": 0, "ok": 0}
    assert s["worst"] == "ok"


def test_banner_reflects_worst_level():
    crit = app._banner(app.summarize({"c": [_series("crit", metric="x")]}))
    assert "kritisch" in crit.lower() or "Kritisch" in crit
    ok = app._banner(app.summarize({"c": [_series("ok")]}))
    assert "normal" in ok
