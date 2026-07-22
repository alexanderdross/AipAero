"""AIP:Aero Health-Dashboard - internal FastAPI app (runs on the Coolify box).

Reads the last 24h of samples from the D1 analytics table through the website's
Bearer-gated `GET /api/health`, groups them by category, and renders a simple
tile dashboard. The `CRON_SECRET` stays server-side here - the browser only ever
talks to this app, which is itself reachable only through the Cloudflare Tunnel
+ Access (docs/health-dashboard-concept.md). LEAN skeleton: last value per metric
+ status pill; time-series charts are a Phase-2 addition.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

API_BASE = os.environ.get("HEALTH_API_BASE", "https://aip.aero").rstrip("/")
API_KEY = os.environ.get("HEALTH_API_KEY", "")
WINDOW_SECONDS = int(os.environ.get("HEALTH_WINDOW_SECONDS", str(60 * 60 * 24)))

# Tile order + human labels for the known categories.
CATEGORY_ORDER = [
    ("cloudflare", "Cloudflare"),
    ("server", "Server"),
    ("coolify", "Coolify"),
    ("database", "Datenbank"),
    ("crawl", "Crawls"),
    ("issues", "Issues"),
    ("vitals", "Web Vitals"),
]

app = FastAPI(title="AIP:Aero Health", docs_url=None, redoc_url=None)


def _fetch_metrics() -> list[dict[str, Any]]:
    """Pull recent samples from the website. Fail-soft to [] on any error."""
    if not API_KEY:
        return []
    since = int(time.time()) - WINDOW_SECONDS
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(
                f"{API_BASE}/api/health",
                params={"since": since, "limit": 20000},
                headers={"Authorization": f"Bearer {API_KEY}"},
            )
            r.raise_for_status()
            return r.json().get("metrics", [])
    except Exception:
        return []


def _latest_per_metric(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group by category -> newest sample per (metric, scope). Rows arrive
    newest-first from the API, so the first seen key wins."""
    seen: set[tuple[str, str, str]] = set()
    by_cat: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (row.get("category", ""), row.get("metric", ""), row.get("scope") or "")
        if key in seen:
            continue
        seen.add(key)
        by_cat[row.get("category", "other")].append(row)
    for cat in by_cat:
        by_cat[cat].sort(key=lambda r: (r.get("metric", ""), r.get("scope") or ""))
    return by_cat


@app.get("/api/data")
def data() -> JSONResponse:
    rows = _fetch_metrics()
    return JSONResponse(
        {
            "generatedAt": int(time.time()),
            "configured": bool(API_KEY),
            "categories": _latest_per_metric(rows),
        }
    )


@app.get("/healthz")
def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    by_cat = _latest_per_metric(_fetch_metrics())
    return HTMLResponse(_render(by_cat))


def _pill(status: str | None) -> str:
    color = {"ok": "#1a7f37", "warn": "#9a6700", "crit": "#cf222e"}.get(
        status or "", "#57606a"
    )
    label = status or "-"
    return f'<span style="background:{color};color:#fff;border-radius:999px;padding:1px 8px;font-size:12px">{label}</span>'


def _fmt(value: Any, unit: str | None) -> str:
    if value is None:
        return "-"
    if unit == "bytes":
        v = float(value)
        for u in ("B", "KB", "MB", "GB", "TB"):
            if v < 1024 or u == "TB":
                return f"{v:.1f} {u}"
            v /= 1024
    if unit == "pct":
        return f"{value:g} %"
    if unit == "s" and isinstance(value, (int, float)):
        return f"{value:g} s"
    return f"{value:g}{(' ' + unit) if unit else ''}"


def _render(by_cat: dict[str, list[dict[str, Any]]]) -> str:
    tiles = []
    for cat_key, cat_label in CATEGORY_ORDER:
        rows = by_cat.get(cat_key, [])
        if not rows:
            body = '<p style="color:#57606a;margin:0">Keine Daten (noch nicht gesammelt / Quelle nicht konfiguriert).</p>'
        else:
            items = "".join(
                f'<tr><td style="padding:4px 10px 4px 0">{r.get("metric","")}'
                + (f' <span style="color:#57606a">/{r.get("scope")}</span>' if r.get("scope") else "")
                + f'</td><td style="padding:4px 10px;text-align:right;font-variant-numeric:tabular-nums">{_fmt(r.get("value"), r.get("unit"))}</td>'
                + f'<td style="padding:4px 0">{_pill(r.get("status"))}</td></tr>'
                for r in rows
            )
            body = f'<table style="width:100%;border-collapse:collapse;font-size:14px">{items}</table>'
        tiles.append(
            f'<section style="background:#fff;border:1px solid #d0d7de;border-radius:10px;padding:14px 16px">'
            f'<h2 style="margin:0 0 10px;font-size:15px;color:#2d6a9a">{cat_label}</h2>{body}</section>'
        )
    configured = "" if API_KEY else (
        '<p style="background:#fff3cd;border:1px solid #e2c700;border-radius:8px;padding:10px 14px">'
        "HEALTH_API_KEY ist nicht gesetzt - das Dashboard kann die Analytics-Tabelle nicht lesen.</p>"
    )
    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIP:Aero Health</title>
<meta name="robots" content="noindex,nofollow">
</head>
<body style="margin:0;background:#f0f2f2;font-family:Inter,Tahoma,Verdana,sans-serif;color:#1f2328">
<header style="background:#2d6a9a;color:#fff;padding:14px 20px">
  <strong style="font-size:16px">AIP:Aero - Health Dashboard</strong>
  <span style="float:right;font-size:12px;opacity:.85">Fenster: letzte 24 h</span>
</header>
<main style="max-width:1100px;margin:0 auto;padding:20px">
  {configured}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">{''.join(tiles)}</div>
  <p style="color:#57606a;font-size:12px;margin-top:18px">Auto-Refresh alle 60 s. Nur ueber Cloudflare Tunnel + Access erreichbar.</p>
</main>
<script>setTimeout(function(){{location.reload()}}, 60000);</script>
</body></html>"""
