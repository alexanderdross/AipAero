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


# Candidate keys for a per-server usage percentage. Coolify's server payload
# shape varies by version / proxy, so we search a few plausible names (and a few
# nested containers) and take the first that looks like a 0..100 percentage.
# Verify against the live Coolify API and prune/extend as needed - unknown fields
# are simply skipped, never guessed.
_SERVER_PCT_METRICS: list[tuple[list[str], str]] = [
    (["cpu", "cpu_usage", "cpu_percent", "cpuUsage", "cpu_used_percent"], "cpu_used_pct"),
    (
        ["memory", "memory_usage", "memory_percent", "memoryUsage", "ram", "ram_usage", "mem_used_percent"],
        "ram_used_pct",
    ),
    (["disk", "disk_usage", "disk_percent", "diskUsage", "disk_used_percent"], "disk_used_pct"),
]
# Nested objects a server might carry its live usage under.
_USAGE_CONTAINERS = ("usage", "metrics", "resources", "stats", "utilization")


def _server_name(server: dict[str, Any]) -> str:
    for key in ("name", "description", "ip", "uuid"):
        v = server.get(key)
        if isinstance(v, str) and v:
            return v
    return "?"


def _as_pct(v: Any) -> float | None:
    """A number in a plausible percentage range (0..100), else None. A 0..1
    ratio is scaled to a percentage."""
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    f = float(v)
    if 0.0 <= f <= 1.0:
        return round(f * 100, 1)
    if 0.0 <= f <= 100.0:
        return round(f, 1)
    return None


def _find_pct(server: dict[str, Any], keys: list[str]) -> float | None:
    # Search the server object itself, then any known nested usage container.
    sources = [server]
    for c in _USAGE_CONTAINERS:
        sub = server.get(c)
        if isinstance(sub, dict):
            sources.append(sub)
    for src in sources:
        for k in keys:
            pct = _as_pct(src.get(k))
            if pct is not None:
                return pct
    return None


def parse_servers(data: Any) -> list[Metric]:
    """Per-server CPU/RAM/disk usage (percent), scope = server name.

    Best-effort + fully defensive: emits a metric only when the server payload
    actually carries a plausible percentage under one of the known keys, so a
    Coolify version that does not expose live usage yields nothing (never a
    wrong value). Complements the box-level psutil gatherer for multi-server
    setups."""
    if not isinstance(data, list):
        return []
    out: list[Metric] = []
    for server in data:
        if not isinstance(server, dict):
            continue
        scope = _server_name(server)
        for keys, metric in _SERVER_PCT_METRICS:
            pct = _find_pct(server, keys)
            if pct is not None:
                out.append(
                    Metric(
                        "coolify",
                        metric,
                        pct,
                        "pct",
                        scope=scope,
                        status="ok" if pct < 90 else "warn",
                    )
                )
    return out
