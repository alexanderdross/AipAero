"""Coolify metrics gatherer - app/container health on the box.

Reads the Coolify `/api/v1/resources` list and buckets it (via the pure
`coolify_parse.parse_resources`) into total / running / unhealthy / stopped -
the app-level signal that psutil (RAM/disk/load of the box) cannot give. Also
emits how many Coolify-managed servers are reachable. Fully fail-soft:
unconfigured or any error -> []. Runs on the box, so the API URL is typically
localhost. (Per-server CPU/RAM is already covered by the local psutil gatherer
on this single-box setup; Coolify's unique value here is deployment/app health.)
"""

from __future__ import annotations

import logging
from typing import List

from . import coolify_parse as parse
from .models import Metric
from .settings import HealthSettings

log = logging.getLogger(__name__)


def gather(settings: HealthSettings) -> List[Metric]:
    base = settings.coolify_api_url
    token = settings.coolify_api_token
    if not base or not token:
        log.info("coolify gatherer: no url/token configured; skipping")
        return []

    metrics: List[Metric] = []
    try:
        import httpx

        headers = {
            "Authorization": f"Bearer {token.get_secret_value()}",
            "Accept": "application/json",
        }
        with httpx.Client(timeout=15.0, base_url=base.rstrip("/")) as client:
            # Application/resource health.
            try:
                r = client.get("/api/v1/resources", headers=headers)
                r.raise_for_status()
                metrics.extend(parse.parse_resources(r.json()))
            except Exception as e:
                log.warning("coolify gatherer: resources read failed (%s)", e)

            # How many managed servers are reachable (a simple availability count).
            try:
                r = client.get("/api/v1/servers", headers=headers)
                r.raise_for_status()
                servers = r.json()
                if isinstance(servers, list):
                    metrics.append(
                        Metric("coolify", "servers_total", float(len(servers)), "count")
                    )
            except Exception as e:
                log.warning("coolify gatherer: servers read failed (%s)", e)
    except Exception as e:
        log.warning("coolify gatherer: run failed (%s)", e)

    log.info("coolify gatherer: collected %d metrics", len(metrics))
    return metrics
