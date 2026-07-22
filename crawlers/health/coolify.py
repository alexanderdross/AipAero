"""Coolify metrics gatherer - app/container health on the box.

Skeleton (Phase 1): when a Coolify API URL + token are configured, reads the
resources list and emits an up/down count; leaves per-server CPU/RAM and
deployment history as a Phase-2 TODO. Fully fail-soft: unconfigured or any
error -> []. Runs on the box, so the API URL is typically localhost.
"""

from __future__ import annotations

import logging
from typing import List

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
            r = client.get("/api/v1/resources", headers=headers)
            r.raise_for_status()
            resources = r.json()

        # Coolify returns a list of resources each with a `status` string
        # (e.g. "running:healthy", "exited:unhealthy"). Count healthy vs total.
        if isinstance(resources, list):
            total = len(resources)
            running = sum(
                1
                for res in resources
                if isinstance(res, dict)
                and str(res.get("status", "")).startswith("running")
            )
            metrics.append(Metric("coolify", "resources_total", float(total), "count"))
            metrics.append(
                Metric(
                    "coolify",
                    "resources_running",
                    float(running),
                    "count",
                    status="ok" if running == total else "warn",
                )
            )
    except Exception as e:
        log.warning("coolify gatherer: read failed (%s)", e)

    # TODO(Phase 2): per-server CPU/RAM/disk from /api/v1/servers, deployments.
    log.info("coolify gatherer: collected %d metrics", len(metrics))
    return metrics
