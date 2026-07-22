"""Cloudflare metrics gatherer - Workers health, traffic, Web Vitals, D1.

Skeleton (Phase 1): reads the D1 database size via the stable D1 REST endpoint
when a token is configured, and leaves the richer GraphQL Analytics queries
(Workers invocations, zone traffic, RUM Web Vitals, D1 analytics) as a
documented Phase-2 TODO. Fully fail-soft: unconfigured or any error -> [].

Phase 2 will POST to https://api.cloudflare.com/client/v4/graphql with:
  - viewer.accounts.workersInvocationsAdaptive  (requests, errors, cpuTime pXX)
  - viewer.zones.httpRequestsAdaptiveGroups      (requests, bytes, status, cache)
  - viewer.accounts.rumPerformanceEventsAdaptiveGroups (LCP/INP/CLS p75)
  - viewer.accounts.d1AnalyticsAdaptiveGroups     (rowsRead/rowsWritten)
mapping each into Metric(category="cloudflare"|"vitals"|"database", ...).
"""

from __future__ import annotations

import logging
from typing import List

from .models import Metric
from .settings import HealthSettings

log = logging.getLogger(__name__)

_API = "https://api.cloudflare.com/client/v4"


def gather(settings: HealthSettings) -> List[Metric]:
    token = settings.cloudflare_analytics_token
    account = settings.cloudflare_account_id
    if not token or not account:
        log.info("cloudflare gatherer: no token/account configured; skipping")
        return []

    metrics: List[Metric] = []
    # Phase 1: the D1 database size + table count (a plain, stable REST GET).
    db_id = settings.cloudflare_d1_database_id
    if db_id:
        try:
            import httpx

            headers = {"Authorization": f"Bearer {token.get_secret_value()}"}
            url = f"{_API}/accounts/{account}/d1/database/{db_id}"
            with httpx.Client(timeout=15.0) as client:
                r = client.get(url, headers=headers)
                r.raise_for_status()
                result = r.json().get("result", {})
            if "file_size" in result:
                metrics.append(
                    Metric(
                        "database",
                        "d1_storage_bytes",
                        float(result["file_size"]),
                        "bytes",
                        scope=result.get("name"),
                    )
                )
            if "num_tables" in result:
                metrics.append(
                    Metric("database", "d1_num_tables", float(result["num_tables"]), "count")
                )
        except Exception as e:
            log.warning("cloudflare gatherer: D1 REST read failed (%s)", e)

    # TODO(Phase 2): GraphQL Analytics for Workers health / traffic / Web Vitals.
    log.info("cloudflare gatherer: collected %d metrics", len(metrics))
    return metrics
