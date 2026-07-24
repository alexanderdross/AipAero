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


def test_group_series_carries_aligned_times():
    rows = [
        {"category": "server", "metric": "m", "scope": None, "value": 42, "recordedAt": 300, "status": "ok"},
        {"category": "server", "metric": "m", "scope": None, "value": 40, "recordedAt": 200, "status": "ok"},
        # a non-numeric value is dropped from BOTH points and times (stay aligned)
        {"category": "server", "metric": "m", "scope": None, "value": None, "recordedAt": 250, "status": "ok"},
    ]
    s = app.group_series(rows)["server"][0]
    assert s["points"] == [40.0, 42.0]
    assert s["times"] == [200, 300]  # ascending, aligned to points


def test_chart_svg_empty_and_axes():
    assert app.chart_svg([], []) == ""
    svg = app.chart_svg([10.0, 20.0, 15.0], [100, 200, 300], unit="pct", status="ok")
    assert svg.startswith("<svg") and "<polyline" in svg
    # Y axis labels carry the unit; X axis carries a UTC time base.
    assert "20 %" in svg and "10 %" in svg
    assert "UTC" in svg
    # gridlines + axis lines present
    assert svg.count("<line") >= 4


def test_chart_svg_flat_series_does_not_divide_by_zero():
    svg = app.chart_svg([7.0, 7.0, 7.0], [1, 2, 3])
    assert "<polyline" in svg  # padded range -> a real line, no crash


def test_fmt_clock_utc():
    # 1970-01-01 01:02:00 UTC
    assert app._fmt_clock(3720, with_date=False) == "01:02"
    assert app._fmt_clock(3720, with_date=True) == "01-01 01:02"


def test_sparkline_has_value_tooltip():
    # native <title> carries min/max/last so hovering shows the actual values
    svg = app.sparkline_svg([1.0, 5.0, 3.0], status="ok")
    assert "<title>min 1, max 5, last 3 (3 Werte)</title>" in svg
    one = app.sparkline_svg([42.0])
    assert "<title>min 42, max 42, last 42 (1 Werte)</title>" in one


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


def test_fmt_age_buckets():
    now = 1_000_000
    assert app.fmt_age(now, now) == "gerade eben"
    assert app.fmt_age(now, now - 30) == "gerade eben"
    assert app.fmt_age(now, now - 180) == "vor 3 min"
    assert app.fmt_age(now, now - 2 * 3600) == "vor 2 h"
    assert app.fmt_age(now, now - 3 * 86400) == "vor 3 d"
    assert app.fmt_age(now, None) == "-"
    assert app.fmt_age(now, now + 100) == "gerade eben"  # future clamps to 0


def test_newest_recorded_at():
    by_cat = {
        "server": [{"recordedAt": 100}, {"recordedAt": 300}],
        "crawl": [{"recordedAt": 250}],
    }
    assert app.newest_recorded_at(by_cat) == 300
    assert app.newest_recorded_at({}) is None
    assert app.newest_recorded_at({"x": [{"recordedAt": None}]}) is None


def test_render_includes_expandable_history_chart():
    by_cat = {
        "server": [
            {
                "metric": "ram_used_pct",
                "scope": "",
                "unit": "pct",
                "status": "ok",
                "value": 42,
                "points": [40.0, 41.0, 42.0],
                "times": [100, 200, 300],
                "recordedAt": 300,
            }
        ]
    }
    html = app._render(by_cat)
    assert "<details><summary" in html and "Verlauf" in html
    assert "<svg" in html


def test_render_uses_polling_refresh_not_hard_reload():
    html = app._render({})
    # Polls /api/data and reloads only on newer data (not a blind timed reload).
    assert "fetch('/api/data'" in html
    assert "d.newestRecordedAt" in html
    assert "location.reload()" in html
    assert "setTimeout(function(){location.reload" not in html


# --- PWA (manifest / icon / service worker / push) --------------------------

from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(app.app)


def test_render_wires_the_pwa():
    html = app._render({})
    assert '<link rel="manifest" href="/manifest.webmanifest">' in html
    assert '<meta name="theme-color" content="#2d6a9a">' in html
    assert "navigator.serviceWorker.register('/sw.js')" in html
    assert 'id="notify-btn"' in html
    assert "/api/push/subscribe" in html


def test_manifest_route():
    r = client.get("/manifest.webmanifest")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/manifest+json")
    body = r.json()
    assert body["name"] == "AIP:Aero Health"
    assert body["display"] == "standalone"
    assert body["icons"] and body["icons"][0]["src"] == "/icon.svg"


def test_icon_route_is_svg():
    r = client.get("/icon.svg")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in r.text


def test_service_worker_route():
    r = client.get("/sw.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-cache"
    # the two behaviours the SW exists for
    assert "addEventListener('push'" in r.text
    assert "caches.open" in r.text


def test_push_config_reflects_key(monkeypatch):
    monkeypatch.setattr(app, "VAPID_PUBLIC_KEY", "")
    off = client.get("/api/push/config").json()
    assert off == {"enabled": False, "publicKey": ""}
    monkeypatch.setattr(app, "VAPID_PUBLIC_KEY", "BKtest")
    on = client.get("/api/push/config").json()
    assert on == {"enabled": True, "publicKey": "BKtest"}


def test_push_subscribe_dedupes_and_unsubscribe(tmp_path, monkeypatch):
    subs_file = tmp_path / "subs.json"
    monkeypatch.setattr(app, "PUSH_SUBS_FILE", str(subs_file))

    sub = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}
    r1 = client.post("/api/push/subscribe", json=sub)
    assert r1.status_code == 200 and r1.json()["count"] == 1
    # same endpoint again -> deduped, still 1
    r2 = client.post("/api/push/subscribe", json=sub)
    assert r2.json()["count"] == 1
    # a different endpoint -> 2
    r3 = client.post(
        "/api/push/subscribe", json={"endpoint": "https://push.example/xyz"}
    )
    assert r3.json()["count"] == 2
    # persisted to disk
    assert app._load_subs() and len(app._load_subs()) == 2

    r4 = client.post("/api/push/unsubscribe", json={"endpoint": "https://push.example/abc"})
    assert r4.json()["count"] == 1
    remaining = app._load_subs()
    assert [s["endpoint"] for s in remaining] == ["https://push.example/xyz"]


def test_push_subscribe_rejects_bad_body():
    assert client.post("/api/push/subscribe", json={"no": "endpoint"}).status_code == 400
