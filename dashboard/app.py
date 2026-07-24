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

import json
import os
import time
from collections import defaultdict
from typing import Any, Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response

API_BASE = os.environ.get("HEALTH_API_BASE", "https://aip.aero").rstrip("/")
API_KEY = os.environ.get("HEALTH_API_KEY", "")
WINDOW_SECONDS = int(os.environ.get("HEALTH_WINDOW_SECONDS", str(60 * 60 * 24)))

# --- PWA / Web Push ---------------------------------------------------------
# The dashboard is a PWA: installable, offline-capable (service worker), and it
# receives Web Push notifications when a metric goes crit. The browser
# subscribes with the VAPID PUBLIC key exposed here; the COLLECTOR holds the
# private key and sends the pushes (crawlers/health/alert.py). Unset public key
# -> the "enable notifications" UI stays hidden (push inert until provisioned).
VAPID_PUBLIC_KEY = os.environ.get("HEALTH_VAPID_PUBLIC_KEY", "")
# Box-local file of browser push subscriptions: WRITTEN here on subscribe, READ
# by the collector to send. Point both processes at the SAME path (a shared
# volume) when they run in separate containers.
PUSH_SUBS_FILE = os.environ.get("HEALTH_PUSH_SUBS_FILE", "push_subscriptions.json")


def _load_subs() -> list[dict[str, Any]]:
    try:
        with open(PUSH_SUBS_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save_subs(subs: list[dict[str, Any]]) -> None:
    try:
        with open(PUSH_SUBS_FILE, "w", encoding="utf-8") as fh:
            json.dump(subs, fh, separators=(",", ":"))
    except OSError:
        pass

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
      {metric, scope, unit, status, value (latest),
       points: [floats, oldest..newest], times: [unix seconds, aligned to points]}
    The API returns rows newest-first; we sort each series ascending by
    recorded_at so the sparkline/chart reads left (old) to right (new). `times`
    is parallel to `points` (same filter + order) so the chart can label a real
    time axis."""
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
        points: list[float] = []
        times: list[int] = []
        for s in samples:
            v = s.get("value")
            if isinstance(v, (int, float)):
                points.append(float(v))
                ts = s.get("recordedAt")
                times.append(int(ts) if isinstance(ts, (int, float)) else 0)
        by_cat[category].append(
            {
                "metric": metric,
                "scope": scope,
                "unit": latest.get("unit"),
                "status": latest.get("status"),
                "value": latest.get("value"),
                "points": points,
                "times": times,
                "recordedAt": latest.get("recordedAt"),
            }
        )
    for cat in by_cat:
        by_cat[cat].sort(key=lambda s: (s["metric"], s["scope"]))
    return by_cat


def summarize(by_cat: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Roll up the latest status of every series into crit/warn/ok counts plus
    the worst level and the crit series (category/metric/scope) for the banner.
    Pure - series with no status are not counted."""
    counts = {"crit": 0, "warn": 0, "ok": 0}
    crit: list[str] = []
    for cat, series in by_cat.items():
        for s in series:
            st = s.get("status")
            if st in counts:
                counts[st] += 1
            if st == "crit":
                label = f"{cat}/{s.get('metric')}"
                if s.get("scope"):
                    label += f"/{s['scope']}"
                crit.append(label)
    worst = "crit" if counts["crit"] else "warn" if counts["warn"] else "ok"
    return {"counts": counts, "worst": worst, "crit": crit}


# A stopped collector is otherwise invisible - the dashboard would keep showing
# the last values with no hint they are stale. If the newest sample is older than
# this (default ~2.5x the 15-min collector interval), flag it.
STALE_SECONDS = int(os.environ.get("HEALTH_STALE_SECONDS", str(40 * 60)))


def newest_recorded_at(by_cat: dict[str, list[dict[str, Any]]]) -> Optional[int]:
    """The most recent sample time across all series, or None when there is no
    data. Used for the global freshness / staleness indicator. Pure."""
    newest: Optional[int] = None
    for series in by_cat.values():
        for s in series:
            ts = s.get("recordedAt")
            if isinstance(ts, (int, float)):
                newest = int(ts) if newest is None else max(newest, int(ts))
    return newest


def fmt_age(now: int, ts: Optional[Any]) -> str:
    """Human 'age' of a timestamp relative to `now` (German). Pure."""
    if not isinstance(ts, (int, float)):
        return "-"
    d = max(0, now - int(ts))
    if d < 60:
        return "gerade eben"
    if d < 3600:
        return f"vor {d // 60} min"
    if d < 86400:
        return f"vor {d // 3600} h"
    return f"vor {d // 86400} d"


@app.get("/api/data")
def data() -> JSONResponse:
    by_cat = group_series(_fetch_metrics())
    return JSONResponse(
        {
            "generatedAt": int(time.time()),
            "newestRecordedAt": newest_recorded_at(by_cat),
            "configured": bool(API_KEY),
            "summary": summarize(by_cat),
            "categories": by_cat,
        }
    )


@app.get("/healthz")
def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


# --- PWA plumbing -----------------------------------------------------------
# All self-contained (no CDN): the manifest, an inline SVG icon, and a
# dependency-free service worker that (a) caches the shell for offline use and
# (b) turns an incoming Web Push into a native notification.

_MANIFEST = {
    "name": "AIP:Aero Health",
    "short_name": "Health",
    "description": "AIP:Aero System-Health-Dashboard",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": "#f0f2f2",
    "theme_color": "#2d6a9a",
    "icons": [
        {"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
        {
            "src": "/icon.svg",
            "sizes": "any",
            "type": "image/svg+xml",
            "purpose": "maskable",
        },
    ],
}

# A simple pulse/heartbeat glyph on the brand-blue tile. `any` + `maskable`, so
# it works as both a normal and an adaptive (safe-zone) icon.
_ICON_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
    '<rect width="512" height="512" rx="96" fill="#2d6a9a"/>'
    '<path d="M64 256h96l40-96 56 192 40-96h152" fill="none" stroke="#fff" '
    'stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></svg>'
)

# Bumping CACHE_VERSION invalidates the old offline shell on the next SW activate.
_SW_JS = """
const CACHE = 'health-shell-v1';
const SHELL = ['/', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Navigations + shell: network-first, falling back to the cached copy offline.
// Never intercept /api/* (always live, and fine to fail when offline).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('/')))
  );
});

// A crit push from the collector -> a native notification.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || 'AIP:Aero Health';
  const body = data.body || 'Ein Systemwert ist kritisch.';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'health-crit',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
"""


@app.get("/manifest.webmanifest")
def manifest() -> Response:
    return Response(
        content=json.dumps(_MANIFEST, separators=(",", ":")),
        media_type="application/manifest+json",
    )


@app.get("/icon.svg")
def icon() -> Response:
    return Response(
        content=_ICON_SVG,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/sw.js")
def service_worker() -> Response:
    # Served no-cache so a redeploy's new SW is picked up promptly.
    return Response(
        content=_SW_JS,
        media_type="text/javascript",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/api/push/config")
def push_config() -> JSONResponse:
    """The VAPID public key the browser needs to subscribe. Empty key -> the UI
    keeps the enable-notifications button hidden (push not provisioned)."""
    return JSONResponse(
        {"enabled": bool(VAPID_PUBLIC_KEY), "publicKey": VAPID_PUBLIC_KEY}
    )


@app.post("/api/push/subscribe")
async def push_subscribe(request: Request) -> JSONResponse:
    """Persist a browser PushSubscription (deduped by endpoint) so the collector
    can push to it. Fail-soft: a malformed body is a 400, storage errors are
    swallowed (the file is best-effort local state)."""
    try:
        sub = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "invalid json"}, status_code=400)
    endpoint = sub.get("endpoint") if isinstance(sub, dict) else None
    if not endpoint:
        return JSONResponse({"ok": False, "error": "no endpoint"}, status_code=400)
    subs = _load_subs()
    subs = [s for s in subs if s.get("endpoint") != endpoint]
    subs.append(sub)
    _save_subs(subs)
    return JSONResponse({"ok": True, "count": len(subs)})


@app.post("/api/push/unsubscribe")
async def push_unsubscribe(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "invalid json"}, status_code=400)
    endpoint = body.get("endpoint") if isinstance(body, dict) else None
    if not endpoint:
        return JSONResponse({"ok": False, "error": "no endpoint"}, status_code=400)
    subs = [s for s in _load_subs() if s.get("endpoint") != endpoint]
    _save_subs(subs)
    return JSONResponse({"ok": True, "count": len(subs)})


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


def _banner(summary: dict[str, Any]) -> str:
    """A colour-coded status summary bar above the tiles."""
    counts = summary["counts"]
    worst = summary["worst"]
    bg = {"crit": "#ffebe9", "warn": "#fff8c5", "ok": "#dafbe1"}[worst]
    border = {"crit": "#cf222e", "warn": "#9a6700", "ok": "#1a7f37"}[worst]
    if worst == "ok":
        headline = f"Alle Systeme normal - {counts['ok']} Metriken ok"
    else:
        headline = (
            f"{counts['crit']} kritisch, {counts['warn']} Warnung, {counts['ok']} ok"
        )
    detail = ""
    if summary["crit"]:
        items = ", ".join(summary["crit"][:8])
        detail = f'<div style="font-size:12px;margin-top:4px;color:#57606a">Kritisch: {items}</div>'
    return (
        f'<div style="background:{bg};border:1px solid {border};border-radius:8px;'
        f'padding:10px 14px;margin-bottom:14px">'
        f'<strong style="font-size:14px">{headline}</strong>{detail}</div>'
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
    # Native SVG <title> = a no-JS hover tooltip carrying the actual values, so
    # the sparkline shows range/last-value, not just a shape (the "no values /
    # no tooltip" gap). Plain text, floats only -> no escaping concern.
    tip = f"min {lo:g}, max {hi:g}, last {values[-1]:g} ({n} Werte)"
    title = f"<title>{tip}</title>"

    def y(v: float) -> float:
        if span == 0:
            return height / 2  # flat line for a constant series
        return pad + inner_h * (1 - (v - lo) / span)

    if n == 1:
        cy = y(values[0])
        return (
            f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
            f'style="vertical-align:middle">{title}'
            f'<circle cx="{width - pad:.1f}" cy="{cy:.1f}" r="2" fill="{color}"/></svg>'
        )

    step = (width - 2 * pad) / (n - 1)
    pts = [(pad + i * step, y(v)) for i, v in enumerate(values)]
    poly = " ".join(f"{x:.1f},{yy:.1f}" for x, yy in pts)
    lx, ly = pts[-1]
    return (
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'style="vertical-align:middle">{title}'
        f'<polyline fill="none" stroke="{color}" stroke-width="1.5" '
        f'stroke-linejoin="round" stroke-linecap="round" points="{poly}"/>'
        f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="2" fill="{color}"/></svg>'
    )


def _fmt_clock(ts: int, with_date: bool) -> str:
    """UTC HH:MM (or 'MM-DD HH:MM' when the span crosses days). Pure - uses
    gmtime so the axis is Zulu, consistent with the rest of the site."""
    tm = time.gmtime(ts)
    if with_date:
        return time.strftime("%m-%d %H:%M", tm)
    return time.strftime("%H:%M", tm)


def chart_svg(
    values: list[float],
    times: list[int],
    unit: Optional[str] = None,
    status: Optional[str] = None,
    width: int = 300,
    height: int = 140,
) -> str:
    """A real time-series line chart with axes (pure SVG, no JS/CDN).

    Unlike the compact `sparkline_svg`, this labels the Y axis (min/mid/max with
    the unit) and the X axis (first/last sample time, UTC), draws gridlines and
    a baseline, and plots the line + last-point dot. Used in the per-metric
    expandable 'Verlauf' section. 0 points -> empty string."""
    n = len(values)
    if n == 0:
        return ""
    color = _STATUS_COLOR.get(status or "", "#2d6a9a")
    # Plot area inside the axis margins.
    ml, mr, mt, mb = 52.0, 10.0, 10.0, 22.0
    pw = width - ml - mr
    ph = height - mt - mb
    lo, hi = min(values), max(values)
    if lo == hi:  # flat series -> pad the range so the line sits mid-plot
        lo, hi = lo - 1, hi + 1
    span = hi - lo
    mid = (lo + hi) / 2

    def y(v: float) -> float:
        return mt + ph * (1 - (v - lo) / span)

    def x(i: int) -> float:
        return ml if n == 1 else ml + pw * (i / (n - 1))

    # Y gridlines + labels at min / mid / max.
    grid = []
    labels = []
    for v in (hi, mid, lo):
        yy = y(v)
        grid.append(
            f'<line x1="{ml:.1f}" y1="{yy:.1f}" x2="{width - mr:.1f}" y2="{yy:.1f}" '
            f'stroke="#e1e4e8" stroke-width="1"/>'
        )
        labels.append(
            f'<text x="{ml - 6:.1f}" y="{yy + 3:.1f}" text-anchor="end" '
            f'font-size="10" fill="#57606a">{_fmt(v, unit)}</text>'
        )

    # X axis: first + last sample time (UTC), with the date when the span > 1 day.
    xlabels = ""
    if times and len(times) == n:
        with_date = (times[-1] - times[0]) > 86400
        y_axis = height - mb + 14
        xlabels = (
            f'<text x="{ml:.1f}" y="{y_axis:.1f}" text-anchor="start" '
            f'font-size="10" fill="#57606a">{_fmt_clock(times[0], with_date)}</text>'
            f'<text x="{width - mr:.1f}" y="{y_axis:.1f}" text-anchor="end" '
            f'font-size="10" fill="#57606a">{_fmt_clock(times[-1], with_date)} UTC</text>'
        )

    pts = [(x(i), y(v)) for i, v in enumerate(values)]
    poly = " ".join(f"{px:.1f},{py:.1f}" for px, py in pts)
    lx, ly = pts[-1]
    axis = (
        f'<line x1="{ml:.1f}" y1="{mt:.1f}" x2="{ml:.1f}" y2="{height - mb:.1f}" '
        f'stroke="#d0d7de" stroke-width="1"/>'
        f'<line x1="{ml:.1f}" y1="{height - mb:.1f}" x2="{width - mr:.1f}" '
        f'y2="{height - mb:.1f}" stroke="#d0d7de" stroke-width="1"/>'
    )
    line = (
        f'<polyline fill="none" stroke="{color}" stroke-width="1.5" '
        f'stroke-linejoin="round" stroke-linecap="round" points="{poly}"/>'
        f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="2.5" fill="{color}"/>'
    )
    return (
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'role="img" style="max-width:100%">'
        f'{"".join(grid)}{axis}{line}{"".join(labels)}{xlabels}</svg>'
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
    now = int(time.time())
    newest = newest_recorded_at(by_cat)
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
                # Tint the whole row for a crit metric so it stands out.
                row_style = (
                    ' style="background:#ffebe9"' if s["status"] == "crit" else ""
                )
                rows.append(
                    f"<tr{row_style}><td style=\"padding:4px 10px 4px 0\">{label}</td>"
                    f'<td style="padding:4px 8px">{spark}</td>'
                    f'<td style="padding:4px 10px;text-align:right;'
                    f'font-variant-numeric:tabular-nums">{_fmt(s["value"], s["unit"])}</td>'
                    f'<td style="padding:4px 0">{_pill(s["status"])}</td>'
                    f'<td style="padding:4px 0 4px 10px;color:#57606a;font-size:12px;'
                    f'white-space:nowrap">{fmt_age(now, s.get("recordedAt"))}</td></tr>'
                )
                # A full time-series chart (axes + UTC time base) on demand, so
                # the compact sparkline stays the overview and the detailed
                # history is one click away (native <details>, no client JS).
                if len(s["points"]) >= 2:
                    chart = chart_svg(
                        s["points"], s.get("times", []), s["unit"], s["status"]
                    )
                    rows.append(
                        f'<tr><td colspan="5" style="padding:0 0 8px">'
                        f'<details><summary style="cursor:pointer;color:#2d6a9a;'
                        f'font-size:12px">Verlauf</summary>'
                        f'<div style="padding:6px 0 2px">{chart}</div>'
                        f"</details></td></tr>"
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
    banner = _banner(summarize(by_cat)) if API_KEY else ""
    # Staleness strip: the newest sample is older than the threshold, so the
    # collector may have stopped (the values below are the last it managed).
    stale_banner = ""
    if API_KEY and newest is not None and (now - newest) > STALE_SECONDS:
        stale_banner = (
            '<div style="background:#ffebe9;border:1px solid #cf222e;border-radius:8px;'
            'padding:10px 14px;margin-bottom:14px;font-size:14px">'
            f"<strong>Daten veraltet</strong> - neueste Messung {fmt_age(now, newest)} "
            "(der Collector meldet sich evtl. nicht mehr).</div>"
        )
    freshness = (
        f"Aktuell: {fmt_age(now, newest)}" if newest is not None else "keine Daten"
    )
    # For the client refresh: the newest sample time this render reflects. The
    # poller reloads ONLY when /api/data reports a newer sample, so a quiet page
    # never flashes a needless full reload (delivers the /api/data endpoint,
    # which nothing consumed before).
    newest_js = str(int(newest)) if newest is not None else "null"
    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIP:Aero Health</title>
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#2d6a9a">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon.svg">
</head>
<body style="margin:0;background:#f0f2f2;font-family:Inter,Tahoma,Verdana,sans-serif;color:#1f2328">
<header style="background:#2d6a9a;color:#fff;padding:14px 20px">
  <strong style="font-size:16px">AIP:Aero - Health Dashboard</strong>
  <button id="notify-btn" hidden style="float:right;margin-left:12px;background:#fff;color:#2d6a9a;border:0;border-radius:999px;padding:4px 12px;font-size:12px;cursor:pointer">Benachrichtigungen aktivieren</button>
  <span style="float:right;font-size:12px;opacity:.85">{freshness} &middot; Fenster: letzte 24 h</span>
</header>
<main style="max-width:1100px;margin:0 auto;padding:20px">
  {configured}
  {stale_banner}
  {banner}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">{''.join(tiles)}</div>
  <p style="color:#57606a;font-size:12px;margin-top:18px">Sparkline = Verlauf der letzten 24 h (Werte im Tooltip). Prueft alle 60 s auf neue Daten und laedt nur dann neu. Nur ueber Cloudflare Tunnel + Access erreichbar.</p>
</main>
<script>
(function(){{
  var last = {newest_js};
  setInterval(function(){{
    fetch('/api/data', {{cache: 'no-store'}})
      .then(function(r){{ return r.json(); }})
      .then(function(d){{
        if (d && d.newestRecordedAt != null && d.newestRecordedAt !== last) {{
          location.reload();
        }}
      }})
      .catch(function(){{}});
  }}, 60000);
}})();

// PWA: register the service worker and, when Web Push is provisioned, wire up
// the "enable notifications" button (subscribe -> POST to /api/push/subscribe).
(function(){{
  if (!('serviceWorker' in navigator)) return;
  var swReady = navigator.serviceWorker.register('/sw.js');

  function urlB64ToUint8(base64){{
    var pad = '='.repeat((4 - base64.length % 4) % 4);
    var b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(b64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }}

  var btn = document.getElementById('notify-btn');
  if (!btn || !('PushManager' in window) || !('Notification' in window)) return;

  fetch('/api/push/config').then(function(r){{ return r.json(); }}).then(function(cfg){{
    if (!cfg || !cfg.enabled || !cfg.publicKey) return;  // push not provisioned
    swReady.then(function(reg){{
      return reg.pushManager.getSubscription();
    }}).then(function(sub){{
      if (sub) return;  // already subscribed on this device -> keep button hidden
      btn.hidden = false;
      btn.addEventListener('click', function(){{
        Notification.requestPermission().then(function(perm){{
          if (perm !== 'granted') return;
          swReady.then(function(reg){{
            return reg.pushManager.subscribe({{
              userVisibleOnly: true,
              applicationServerKey: urlB64ToUint8(cfg.publicKey),
            }});
          }}).then(function(sub){{
            return fetch('/api/push/subscribe', {{
              method: 'POST',
              headers: {{'Content-Type': 'application/json'}},
              body: JSON.stringify(sub),
            }});
          }}).then(function(){{
            btn.hidden = true;
          }}).catch(function(){{}});
        }});
      }});
    }}).catch(function(){{}});
  }}).catch(function(){{}});
}})();
</script>
</body></html>"""
