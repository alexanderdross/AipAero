"""Health-dashboard collector package.

Gathers system-health metrics from several sources (local host via psutil, the
Cloudflare GraphQL/REST analytics API, the Coolify API, GitHub and Sentry) and
publishes them to the website's `POST /api/health` ingest endpoint, which writes
them into the D1 `aip_aero_v4_health_metrics` table. An internal, Cloudflare-
Tunnel-gated dashboard then reads them back through `GET /api/health`.

Design: every gatherer is fully fail-soft - a dead/unconfigured source returns
an empty list, never raising, so one broken source never aborts a collection
run (mirrors the per-country isolation in `crawlers/main.py`). See
docs/health-dashboard-concept.md.
"""
