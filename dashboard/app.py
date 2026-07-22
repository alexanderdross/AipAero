"""AIP:Aero Health-Dashboard - internal FastAPI app (runs on the Coolify box).

Reads the last 24h of samples from the D1 analytics table through the website's
Bearer-gated `GET /api/health`, groups them by category, and renders a tile
dashboard: per (metric, scope) the latest value, a status pill, and an inline
SVG **sparkline** of its recent series (no external JS/CDN - the SVG paths are
built server-side, so the page stays self-contained behind the tunnel). The
`CRON_SECRET` stays server-side here - the browser only ever talks to this app,
which is itself reachable only through the Cloudflare Tunnel + Access
(docs/health-dashboard-concept.md).
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import Any, Optional

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


def group_series(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group raw samples into per-category series.

    Returns category -> list of series dicts, each:
      {metric, scope, unit, status, value (latest), points: [floats, oldest..newest]}
    The API returns rows newest-first; we sort each series ascending by
    recorded_at so the sparkline reads left (old) to right (new)."""
    buckets: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (
            row.get("category", "other"),
            row.get("metric", ""),
            row.get("scope") or "",
        )
        buckets[key].append(row)

    by_cat: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for (category, metric, scope), samples in buckets.items():
        samples.sort(key=lambda r: r.get("recordedAt") or 0)
        latest = samples[-1]
        points = [
            float(s["value"])
            for s in samples
            if isinstance(s.get("value"), (int, float))
        ]
        by_cat[category].append(
            {
                "metric": metric,
                "scope": scope,
                "unit": latest.get("unit"),
                "status": latest.get("status"),
                "value": latest.get("value"),
                "points": points,
            }
        )
    for cat in by_cat:
        by_cat[cat].sort(key=lambda s: (s["metric"], s["scope"]))
    return by_cat


@app.get("/api/data")
def data() -> JSONResponse:
    return JSONResponse(
        {
            "generatedAt": int(time.time()),
            "configured": bool(API_KEY),
            "categories": group_series(_fetch_metrics()),
        }
    )


@app.get("/healthz")
def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse(_render(group_series(_fetch_metrics())))


_STATUS_COLOR = {"ok": "#1a7f37", "warn": "#9a6700", "crit": "#cf222e"}


def _pill(status: Optional[str]) -> str:
    color = _STATUS_COLOR.get(status or "", "#57606a")
    return (
        f'<span style="background:{color};color:#fff;border-radius:999px;'
        f'padding:1px 8px;font-size:12px">{status or "-"}</span>'
    )


def sparkline_svg(
    values: list[float], status: Optional[str] = None, width: int = 120, height: int = 24
) -> str:
    """Inline SVG sparkline for a numeric series (oldest..newest). Pure/no deps.

    - 0 points -> empty string.
    - 1 point (or a flat series) -> a centred horizontal line.
    Y is normalised to [min, max] over the series; the last point gets a dot."""
    pad = 2.0
    n = len(values)
    if n == 0:
        return ""
    color = _STATUS_COLOR.get(status or "", "#2d6a9a")
    lo, hi = min(values), max(values)
    span = hi - lo
    inner_h = height - 2 * pad

    def y(v: float) -> float:
        if span == 0:
            return height / 2  # flat line for a constant series
        return pad + inner_h * (1 - (v - lo) / span)

    if n == 1:
        cy = y(values[0])
        return (
            f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
            f'style="vertical-align:middle">'
            f'<circle cx="{width - pad:.1f}" cy="{cy:.1f}" r="2" fill="{color}"/></svg>'
        )

    step = (width - 2 * pad) / (n - 1)
    pts = [(pad + i * step, y(v)) for i, v in enumerate(values)]
    poly = " ".join(f"{x:.1f},{yy:.1f}" for x, yy in pts)
    lx, ly = pts[-1]
    return (
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'style="vertical-align:middle">'
        f'<polyline fill="none" stroke="{color}" stroke-width="1.5" '
        f'stroke-linejoin="round" stroke-linecap="round" points="{poly}"/>'
        f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="2" fill="{color}"/></svg>'
    )


def _fmt(value: Any, unit: Optional[str]) -> str:
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
        series = by_cat.get(cat_key, [])
        if not series:
            body = (
                '<p style="color:#57606a;margin:0">Keine Daten (noch nicht '
                "gesammelt / Quelle nicht konfiguriert).</p>"
            )
        else:
            rows = []
            for s in series:
                label = s["metric"] + (
                    f' <span style="color:#57606a">/{s["scope"]}</span>'
                    if s["scope"]
                    else ""
                )
                spark = sparkline_svg(s["points"], s["status"])
                rows.append(
                    f'<tr><td style="padding:4px 10px 4px 0">{label}</td>'
                    f'<td style="padding:4px 8px">{spark}</td>'
                    f'<td style="padding:4px 10px;text-align:right;'
                    f'font-variant-numeric:tabular-nums">{_fmt(s["value"], s["unit"])}</td>'
                    f'<td style="padding:4px 0">{_pill(s["status"])}</td></tr>'
                )
            body = (
                '<table style="width:100%;border-collapse:collapse;font-size:14px">'
                + "".join(rows)
                + "</table>"
            )
        tiles.append(
            '<section style="background:#fff;border:1px solid #d0d7de;'
            'border-radius:10px;padding:14px 16px">'
            f'<h2 style="margin:0 0 10px;font-size:15px;color:#2d6a9a">{cat_label}</h2>'
            f"{body}</section>"
        )
    configured = (
        ""
        if API_KEY
        else (
            '<p style="background:#fff3cd;border:1px solid #e2c700;border-radius:8px;'
            'padding:10px 14px">HEALTH_API_KEY ist nicht gesetzt - das Dashboard kann '
            "die Analytics-Tabelle nicht lesen.</p>"
        )
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
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">{''.join(tiles)}</div>
  <p style="color:#57606a;font-size:12px;margin-top:18px">Sparkline = Verlauf der letzten 24 h. Auto-Refresh alle 60 s. Nur ueber Cloudflare Tunnel + Access erreichbar.</p>
</main>
<script>setTimeout(function(){{location.reload()}}, 60000);</script>
</body></html>"""
