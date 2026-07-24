"""Health-dashboard collector - entry point.

Runs on the Coolify/netcup box (a Coolify Scheduled Task, ~every 15 min - the
same pattern as the OurAirports importer in docs/data-backfill-runbook.md).
Calls every source gatherer (each fully fail-soft), then publishes the collected
samples to the website's `POST /api/health` (Bearer CRON_SECRET), which appends
them to the D1 `aip_aero_v4_health_metrics` table. The last write carries
`?prune=1` so the append-only series stays bounded (server-side 90-day cutoff).

Without `HEALTH_API_KEY`/`API_KEY` set, runs in DRY-RUN: gathers + logs the
metrics but does not POST (useful for a local box smoke test).

Usage:
    uv run health_collector.py            # collect + publish (or dry-run)
    uv run health_collector.py --dry-run  # never publish, just log
"""

from __future__ import annotations

import logging
import sys
import time
from typing import List

from health.models import Metric
from health.settings import HealthSettings
from health import alert, cloudflare, coolify, github, sentry, server

log = logging.getLogger("health_collector")

HTTP_TIMEOUT = 30.0


def collect(settings: HealthSettings) -> List[Metric]:
    """Run every gatherer in isolation - one dead source never aborts the run."""
    metrics: List[Metric] = []
    gatherers = [
        ("server", lambda: server.gather()),
        ("cloudflare", lambda: cloudflare.gather(settings)),
        ("coolify", lambda: coolify.gather(settings)),
        ("github", lambda: github.gather(settings)),
        ("sentry", lambda: sentry.gather(settings)),
    ]
    for name, run in gatherers:
        try:
            got = run()
            metrics.extend(got)
        except Exception:  # defensive: gatherers are already fail-soft
            log.exception("gatherer %s crashed; skipping", name)
    # Stamp a single run timestamp on any metric that did not set its own, so all
    # of a run's samples share one recorded_at (cleaner time-series alignment).
    now = int(time.time())
    for m in metrics:
        if m.recorded_at is None:
            m.recorded_at = now
    return metrics


def publish(settings: HealthSettings, metrics: List[Metric]) -> bool:
    """POST the batch to /api/health with prune on the final call. Returns ok."""
    if settings.api_key is None:
        log.warning("HEALTH_API_KEY unset - DRY-RUN, not publishing")
        return False
    if not metrics:
        log.info("no metrics to publish")
        return True

    import httpx

    url = f"{settings.api_base.rstrip('/')}/api/health?prune=1"
    payload = [m.to_payload() for m in metrics]
    headers = {"Authorization": f"Bearer {settings.api_key.get_secret_value()}"}
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            r = client.post(url, json=payload, headers=headers)
            r.raise_for_status()
        log.info("published %d metrics -> %s (HTTP %d)", len(payload), url, r.status_code)
        return True
    except Exception as e:
        log.error("publish failed: %s", e)
        return False


def main() -> int:
    dry_run = "--dry-run" in sys.argv[1:]
    try:
        settings = HealthSettings()
    except Exception as e:
        print(f"Failed to load HealthSettings: {e}", file=sys.stderr)
        return 1

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    start = time.perf_counter()
    metrics = collect(settings)
    log.info(
        "collected %d metrics in %.2fs across %d categories",
        len(metrics),
        time.perf_counter() - start,
        len({m.category for m in metrics}),
    )
    for m in metrics:
        log.debug("  %s/%s = %s%s", m.category, m.metric, m.value, f" {m.unit}" if m.unit else "")

    # Push a notification for any metric that went crit (inert without an alert
    # channel, fail-soft). Skipped in dry-run - like publishing.
    if not dry_run:
        alert.run_alerts(settings, metrics, int(time.time()))

    if dry_run:
        log.info("--dry-run: skipping publish")
        return 0

    ok = publish(settings, metrics)
    return 0 if ok or settings.api_key is None else 1


if __name__ == "__main__":
    raise SystemExit(main())
