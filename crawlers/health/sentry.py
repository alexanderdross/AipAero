"""Sentry metrics gatherer - unresolved issues.

Counts unresolved issues for the configured Sentry project, reading the TRUE
total from Sentry's `X-Hits` pagination header when present (so the figure is not
silently capped at the one-page limit) and falling back to the page length
otherwise. Status stays deliberately conservative - `0` ok, `> 0` warn, never
crit - because the unresolved-issue count is not a clear page-me signal and the
collector now alerts on crit. Fully fail-soft: unconfigured or any error -> [].
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
            # Unresolved issues. Prefer the true total from the `X-Hits`
            # pagination header so a busy project is not capped at one page;
            # fall back to the returned page length.
            r = client.get(
                f"/projects/{org}/{project}/issues/",
                params={"query": "is:unresolved", "statsPeriod": "24h", "limit": 100},
            )
            r.raise_for_status()
            issues = r.json()
            page_len = len(issues) if isinstance(issues, list) else 0
            count = page_len
            hits = r.headers.get("X-Hits")
            if hits is not None:
                try:
                    count = int(hits)
                except (TypeError, ValueError):
                    count = page_len
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
