"""Local host metrics gatherer - RAM, disk (the owner's "ROM"), CPU load.

This is the one source that MUST run on the box: it reads the machine the
collector itself runs on (the Coolify/netcup host). Uses psutil, imported lazily
so importing this module never requires psutil in a psutil-less env (CI import
smoke test). Fully fail-soft: any error -> [] (never raises).
"""

from __future__ import annotations

import logging
import os
from typing import List

from .models import Metric

log = logging.getLogger(__name__)


def gather() -> List[Metric]:
    try:
        import psutil  # lazy: keeps the module importable without psutil
    except Exception as e:  # pragma: no cover - import guard
        log.warning("server gatherer: psutil unavailable (%s); skipping", e)
        return []

    metrics: List[Metric] = []
    try:
        vm = psutil.virtual_memory()
        metrics.append(Metric("server", "ram_used_pct", round(vm.percent, 1), "pct"))
        metrics.append(Metric("server", "ram_used_bytes", float(vm.used), "bytes"))
        metrics.append(Metric("server", "ram_total_bytes", float(vm.total), "bytes"))
    except Exception as e:
        log.warning("server gatherer: memory read failed (%s)", e)

    try:
        sm = psutil.swap_memory()
        metrics.append(Metric("server", "swap_used_pct", round(sm.percent, 1), "pct"))
    except Exception as e:
        log.warning("server gatherer: swap read failed (%s)", e)

    try:
        # Root filesystem usage = the "ROM"/disk figure. Extend with more mounts
        # (e.g. the Coolify data volume) once the box layout is known.
        du = psutil.disk_usage("/")
        metrics.append(Metric("server", "disk_used_pct", round(du.percent, 1), "pct"))
        metrics.append(Metric("server", "disk_used_bytes", float(du.used), "bytes"))
        metrics.append(Metric("server", "disk_total_bytes", float(du.total), "bytes"))
    except Exception as e:
        log.warning("server gatherer: disk read failed (%s)", e)

    try:
        # 1/5/15-min load average, normalised per-core so >1 = saturated.
        cores = os.cpu_count() or 1
        one, five, fifteen = psutil.getloadavg()
        metrics.append(Metric("server", "load1", round(one, 2), "count"))
        metrics.append(Metric("server", "load5", round(five, 2), "count"))
        metrics.append(Metric("server", "load15", round(fifteen, 2), "count"))
        metrics.append(
            Metric("server", "load1_per_core", round(one / cores, 3), "ratio")
        )
    except Exception as e:
        log.warning("server gatherer: loadavg read failed (%s)", e)

    try:
        # A short blocking sample so the % reflects the last interval, not since boot.
        metrics.append(
            Metric("server", "cpu_used_pct", round(psutil.cpu_percent(interval=0.5), 1), "pct")
        )
    except Exception as e:
        log.warning("server gatherer: cpu read failed (%s)", e)

    try:
        metrics.append(
            Metric("server", "uptime_s", float(int(psutil.boot_time())), "s", meta={"kind": "boot_time"})
        )
    except Exception as e:
        log.warning("server gatherer: uptime read failed (%s)", e)

    log.info("server gatherer: collected %d metrics", len(metrics))
    return metrics
