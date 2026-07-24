"""Local host metrics gatherer - RAM, disk (the owner's "ROM"), CPU load.

This is the one source that MUST run on the box: it reads the machine the
collector itself runs on (the Coolify/netcup host). Uses psutil, imported lazily
so importing this module never requires psutil in a psutil-less env (CI import
smoke test). Fully fail-soft: any error -> [] (never raises).
"""

from __future__ import annotations

import logging
import os
import time
from typing import List, Optional

from .models import Metric

log = logging.getLogger(__name__)


def _status(value: float, warn: float, crit: float) -> str:
    """Classify a saturation figure against warn/crit thresholds (higher = worse).

    Without this every server metric shipped ``status=None`` and the dashboard's
    banner rollup ignores status-less rows, so the box could be saturated while
    the banner read "all normal". Thresholds are deliberately conservative; tune
    from the live series once a baseline exists.
    """
    if value >= crit:
        return "crit"
    if value >= warn:
        return "warn"
    return "ok"


def gather() -> List[Metric]:
    try:
        import psutil  # lazy: keeps the module importable without psutil
    except Exception as e:  # pragma: no cover - import guard
        log.warning("server gatherer: psutil unavailable (%s); skipping", e)
        return []

    metrics: List[Metric] = []

    def add(metric: str, value: float, unit: str, status: Optional[str] = None) -> None:
        metrics.append(Metric("server", metric, value, unit, status=status))

    try:
        vm = psutil.virtual_memory()
        add("ram_used_pct", round(vm.percent, 1), "pct", _status(vm.percent, 85, 95))
        add("ram_used_bytes", float(vm.used), "bytes")
        add("ram_total_bytes", float(vm.total), "bytes")
    except Exception as e:
        log.warning("server gatherer: memory read failed (%s)", e)

    try:
        sm = psutil.swap_memory()
        # Sustained swap use on this box is a memory-pressure signal.
        add("swap_used_pct", round(sm.percent, 1), "pct", _status(sm.percent, 50, 90))
    except Exception as e:
        log.warning("server gatherer: swap read failed (%s)", e)

    try:
        # Root filesystem usage = the "ROM"/disk figure. Extend with more mounts
        # (e.g. the Coolify data volume) once the box layout is known.
        du = psutil.disk_usage("/")
        add("disk_used_pct", round(du.percent, 1), "pct", _status(du.percent, 85, 95))
        add("disk_used_bytes", float(du.used), "bytes")
        add("disk_total_bytes", float(du.total), "bytes")
    except Exception as e:
        log.warning("server gatherer: disk read failed (%s)", e)

    try:
        # 1/5/15-min load average, normalised per-core so >1 = saturated.
        cores = os.cpu_count() or 1
        one, five, fifteen = psutil.getloadavg()
        per_core = one / cores
        add("load1", round(one, 2), "count")
        add("load5", round(five, 2), "count")
        add("load15", round(fifteen, 2), "count")
        # Per-core load: 1.0 = fully subscribed, >2 = heavily oversubscribed.
        add("load1_per_core", round(per_core, 3), "ratio", _status(per_core, 1.0, 2.0))
    except Exception as e:
        log.warning("server gatherer: loadavg read failed (%s)", e)

    try:
        # A short blocking sample so the % reflects the last interval, not since boot.
        cpu = psutil.cpu_percent(interval=0.5)
        add("cpu_used_pct", round(cpu, 1), "pct", _status(cpu, 85, 95))
    except Exception as e:
        log.warning("server gatherer: cpu read failed (%s)", e)

    try:
        # Real uptime = now - boot_time (previously this stored the absolute
        # boot_time epoch, which rendered as a nonsensical 10-digit "seconds").
        uptime = max(0.0, time.time() - psutil.boot_time())
        add("uptime_s", float(int(uptime)), "s")
    except Exception as e:
        log.warning("server gatherer: uptime read failed (%s)", e)

    log.info("server gatherer: collected %d metrics", len(metrics))
    return metrics
