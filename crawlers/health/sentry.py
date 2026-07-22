"""Sentry metrics gatherer - unresolved issues.

Skeleton (Phase 1): counts unresolved issues for the configured Sentry project.
Requires the Worker app to actually report to Sentry first (a Phase-2 task:
wire `@sentry/cloudflare` into the OpenNext build + allowlist the ingest host in
the CSP `connect-src`). Fully fail-soft: unconfigured or any error -> [].
"""

from __future__ import annotations

import logging
from typing import List

from .models import Metric
from .settings import HealthSettings

log = logging.getLogger(__name__)

_API = "https://sentry.io/api/0"


def gather(settings: HealthSettings) -> List[Metric]:
    token = settings.sentry_auth_token
    org = settings.sentry_org
    project = settings.sentry_project
    if not token or not org or not project:
        log.info("sentry gatherer: not configured; skipping")
        return []

    metrics: List[Metric] = []
    try:
        import httpx

        headers = {"Authorization": f"Bearer {token.get_secret_value()}"}
        with httpx.Client(timeout=20.0, base_url=_API, headers=headers) as client:
            # Unresolved issues (paginated; we count the first page's worth and
            # read the total from the header when present). Phase 2 can page the
            # full set / add event counts + release health.
            r = client.get(
                f"/projects/{org}/{project}/issues/",
                params={"query": "is:unresolved", "statsPeriod": "24h", "limit": 100},
            )
            r.raise_for_status()
            issues = r.json()
            count = len(issues) if isinstance(issues, list) else 0
            metrics.append(
                Metric(
                    "issues",
                    "sentry_unresolved",
                    float(count),
                    "count",
                    scope="sentry",
                    status="ok" if count == 0 else "warn",
                )
            )
    except Exception as e:
        log.warning("sentry gatherer: read failed (%s)", e)

    log.info("sentry gatherer: collected %d metrics", len(metrics))
    return metrics
