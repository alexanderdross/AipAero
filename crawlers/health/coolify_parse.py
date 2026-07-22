"""Pure mapper: Coolify /api/v1/resources response -> Metric list.

Split from the HTTP client (`coolify.py`) so the status-bucketing logic is
unit-testable without a network (same pattern as cloudflare_parse). Coolify
reports each resource with a `status` string like "running:healthy",
"running:unhealthy", "exited:unhealthy", "restarting:healthy" or "degraded".
We bucket those into running / unhealthy / stopped counts - the app-level signal
psutil (RAM/disk/load of the box) cannot give. Fully defensive: a missing/odd
field is skipped, never raises.
"""

from __future__ import annotations

from typing import Any

from .models import Metric


def _state(status: Any) -> str:
    """The leading state token of a Coolify status ("running:healthy" -> "running")."""
    if not isinstance(status, str):
        return ""
    return status.split(":", 1)[0].strip().lower()


def _name(res: dict[str, Any]) -> str:
    for key in ("name", "fqdn", "uuid"):
        v = res.get(key)
        if isinstance(v, str) and v:
            return v
    return "?"


def parse_resources(data: Any) -> list[Metric]:
    """Bucket the resources list into total / running / unhealthy / stopped and
    emit a health pill. Unhealthy resource names ride in the meta blob."""
    if not isinstance(data, list):
        return []
    total = 0
    running = 0
    unhealthy: list[str] = []
    stopped = 0
    for res in data:
        if not isinstance(res, dict):
            continue
        total += 1
        status = res.get("status", "")
        state = _state(status)
        if state == "running":
            running += 1
        if isinstance(status, str) and "unhealthy" in status.lower():
            unhealthy.append(_name(res))
        if state in ("exited", "stopped", "dead", "removed"):
            stopped += 1

    out: list[Metric] = [
        Metric("coolify", "resources_total", float(total), "count"),
        Metric(
            "coolify",
            "resources_running",
            float(running),
            "count",
            status="ok" if running == total else "warn",
        ),
        Metric(
            "coolify",
            "resources_unhealthy",
            float(len(unhealthy)),
            "count",
            status="ok" if not unhealthy else "crit",
            meta={"names": unhealthy} if unhealthy else None,
        ),
        Metric(
            "coolify",
            "resources_stopped",
            float(stopped),
            "count",
            status="ok" if stopped == 0 else "warn",
        ),
    ]
    return out
