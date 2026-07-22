"""Cloudflare metrics gatherer - Workers health, traffic, Web Vitals, D1.

POSTs the GraphQL Analytics API for the account/zone and maps the responses via
the pure parsers in `cloudflare_parse.py`; additionally reads the D1 database
size via the stable D1 REST endpoint. Fully fail-soft: unconfigured, a network
error, or a GraphQL `errors` payload each yield [] for that source, never a
crash (a partial-config run still returns whatever succeeded).

Time windows: Workers / traffic / D1 sample the last hour; Web Vitals the last
24 h (needs enough pageloads for a stable p75). The collector runs ~every 15 min,
so consecutive samples overlap - that is fine, the dashboard reads the newest.
"""

from __future__ import annotations

import logging
import time
from typing import Any, List, Optional

from . import cloudflare_parse as parse
from .models import Metric
from .settings import HealthSettings

log = logging.getLogger(__name__)

_API = "https://api.cloudflare.com/client/v4"
_GRAPHQL = f"{_API}/graphql"
_HTTP_TIMEOUT = 20.0

_WORKERS_QUERY = """
query($account: String!, $script: String!, $since: Time!, $until: Time!) {
  viewer { accounts(filter: {accountTag: $account}) {
    workersInvocationsAdaptive(
      limit: 100,
      filter: {scriptName: $script, datetime_geq: $since, datetime_leq: $until}
    ) {
      dimensions { scriptName }
      sum { requests errors subrequests }
      quantiles { cpuTimeP50 cpuTimeP99 durationP50 durationP99 }
    }
  } }
}
""".strip()

_TRAFFIC_QUERY = """
query($zone: String!, $since: Time!, $until: Time!) {
  viewer { zones(filter: {zoneTag: $zone}) {
    httpRequests1hGroups(
      limit: 24,
      filter: {datetime_geq: $since, datetime_leq: $until},
      orderBy: [datetime_DESC]
    ) {
      sum { requests bytes cachedRequests cachedBytes pageViews threats }
      uniq { uniques }
    }
  } }
}
""".strip()

_VITALS_QUERY = """
query($account: String!, $since: Time!, $until: Time!) {
  viewer { accounts(filter: {accountTag: $account}) {
    rumPerformanceEventsAdaptiveGroups(
      limit: 1,
      filter: {datetime_geq: $since, datetime_leq: $until},
      orderBy: [count_DESC]
    ) {
      count
      quantiles {
        largestContentfulPaintP75
        firstContentfulPaintP75
        firstInputDelayP75
        interactionToNextPaintP75
        cumulativeLayoutShiftP75
      }
    }
  } }
}
""".strip()

_D1_QUERY = """
query($account: String!, $since: Time!, $until: Time!) {
  viewer { accounts(filter: {accountTag: $account}) {
    d1AnalyticsAdaptiveGroups(
      limit: 100,
      filter: {datetime_geq: $since, datetime_leq: $until}
    ) {
      sum { readQueries writeQueries rowsRead rowsWritten queryBatchResponseBytes }
    }
  } }
}
""".strip()


def _iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


def _graphql(client: Any, token: str, query: str, variables: dict[str, Any]) -> Optional[dict]:
    """POST one GraphQL query. Returns the parsed JSON, or None on any failure
    (transport error, non-2xx, or a non-empty `errors` array)."""
    try:
        r = client.post(
            _GRAPHQL,
            json={"query": query, "variables": variables},
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        body = r.json()
    except Exception as e:
        log.warning("cloudflare GraphQL request failed (%s)", e)
        return None
    if body.get("errors"):
        log.warning("cloudflare GraphQL returned errors: %s", body["errors"])
        return None
    return body


def _d1_size(client: Any, token: str, account: str, db_id: str) -> List[Metric]:
    try:
        r = client.get(
            f"{_API}/accounts/{account}/d1/database/{db_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        result = r.json().get("result", {})
    except Exception as e:
        log.warning("cloudflare gatherer: D1 REST read failed (%s)", e)
        return []
    out: List[Metric] = []
    if "file_size" in result:
        out.append(
            Metric("database", "d1_storage_bytes", float(result["file_size"]), "bytes", scope=result.get("name"))
        )
    if "num_tables" in result:
        out.append(Metric("database", "d1_num_tables", float(result["num_tables"]), "count"))
    return out


def gather(settings: HealthSettings) -> List[Metric]:
    token = settings.cloudflare_analytics_token
    account = settings.cloudflare_account_id
    if not token or not account:
        log.info("cloudflare gatherer: no token/account configured; skipping")
        return []

    secret = token.get_secret_value()
    now = time.time()
    since_1h = _iso(now - 3600)
    since_24h = _iso(now - 86400)
    until = _iso(now)
    metrics: List[Metric] = []

    try:
        import httpx

        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            # Workers health.
            body = _graphql(
                client, secret, _WORKERS_QUERY,
                {"account": account, "script": settings.cloudflare_worker_name, "since": since_1h, "until": until},
            )
            if body:
                metrics.extend(parse.parse_workers(body))

            # Zone traffic (only if a zone id is configured).
            if settings.cloudflare_zone_id:
                body = _graphql(
                    client, secret, _TRAFFIC_QUERY,
                    {"zone": settings.cloudflare_zone_id, "since": since_1h, "until": until},
                )
                if body:
                    metrics.extend(parse.parse_traffic(body))

            # RUM Web Vitals (24h window).
            body = _graphql(
                client, secret, _VITALS_QUERY,
                {"account": account, "since": since_24h, "until": until},
            )
            if body:
                metrics.extend(parse.parse_vitals(body))

            # D1 analytics (last hour).
            body = _graphql(
                client, secret, _D1_QUERY,
                {"account": account, "since": since_1h, "until": until},
            )
            if body:
                metrics.extend(parse.parse_d1(body))

            # D1 storage size (REST).
            if settings.cloudflare_d1_database_id:
                metrics.extend(_d1_size(client, secret, account, settings.cloudflare_d1_database_id))
    except Exception as e:
        log.warning("cloudflare gatherer: run failed (%s)", e)

    log.info("cloudflare gatherer: collected %d metrics", len(metrics))
    return metrics
