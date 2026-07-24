"""Pure mappers: Cloudflare GraphQL Analytics responses -> Metric lists.

Kept separate from the HTTP client (`cloudflare.py`) so the mapping is unit-
testable against fixture JSON without any network - the same split as the
website's `openaip-parse.ts` (pure) vs `openaip.ts` (fetch). Every mapper is
fully defensive: a missing/renamed GraphQL field simply yields fewer metrics,
never a KeyError - so an API schema drift degrades gracefully instead of
crashing the collector run.

Response shape (all datasets):
    { "data": { "viewer": { "accounts"|"zones": [ { "<dataset>": [ ...rows ] } ] } },
      "errors": null }
"""

from __future__ import annotations

from typing import Any, Iterable, Optional

from .models import Metric


def _num(x: Any) -> Optional[float]:
    """Coerce to float, or None for missing/non-numeric (never raises)."""
    if x is None or isinstance(x, bool):
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _worse_status(value: float, warn: float, crit: float) -> str:
    """ok/warn/crit for a metric where higher = worse (>= crit crit, >= warn warn)."""
    if value >= crit:
        return "crit"
    if value >= warn:
        return "warn"
    return "ok"


def _rows(data: Any, container: str, dataset: str) -> list[dict[str, Any]]:
    """viewer.<container>[0].<dataset> as a list of row dicts, defensively."""
    try:
        nodes = (data or {}).get("data", {}).get("viewer", {}).get(container, [])
        if not nodes:
            return []
        rows = (nodes[0] or {}).get(dataset, [])
        return [r for r in rows if isinstance(r, dict)]
    except (AttributeError, IndexError, TypeError):
        return []


def _emit(
    out: list[Metric],
    source: dict[str, Any],
    mapping: Iterable[tuple[str, str, str, Optional[str]]],
    category: str,
    scope: Optional[str],
) -> None:
    """For each (src_key, metric, unit, _) whose value is numeric, append a Metric."""
    for src_key, metric, unit, _ in mapping:
        v = _num(source.get(src_key))
        if v is not None:
            out.append(Metric(category, metric, v, unit, scope=scope))


def parse_workers(data: Any) -> list[Metric]:
    """workersInvocationsAdaptive -> requests/errors/subrequests + cpuTime pXX.

    Aggregates the `sum` block across rows (one row per scriptName dimension)
    and reads the `quantiles` block for CPU-time percentiles.
    """
    out: list[Metric] = []
    for row in _rows(data, "accounts", "workersInvocationsAdaptive"):
        scope = None
        dims = row.get("dimensions")
        if isinstance(dims, dict):
            scope = dims.get("scriptName")
        s = row.get("sum") if isinstance(row.get("sum"), dict) else {}
        q = row.get("quantiles") if isinstance(row.get("quantiles"), dict) else {}
        _emit(
            out,
            s,
            [
                ("requests", "worker_requests", "count", None),
                ("errors", "worker_errors", "count", None),
                ("subrequests", "worker_subrequests", "count", None),
            ],
            "cloudflare",
            scope,
        )
        # Error rate as a ratio (0..1) when both are present and requests > 0.
        req = _num(s.get("requests"))
        err = _num(s.get("errors"))
        if req and req > 0 and err is not None:
            rate = err / req
            out.append(
                Metric(
                    "cloudflare",
                    "worker_error_rate",
                    round(rate, 5),
                    "ratio",
                    scope=scope,
                    # < 1% ok, < 5% warn, >= 5% crit (previously never reached crit).
                    status=_worse_status(rate, 0.01, 0.05),
                )
            )
        _emit(
            out,
            q,
            [
                ("cpuTimeP50", "worker_cpu_p50_ms", "ms", None),
                ("cpuTimeP99", "worker_cpu_p99_ms", "ms", None),
                ("durationP50", "worker_duration_p50_ms", "ms", None),
                ("durationP99", "worker_duration_p99_ms", "ms", None),
            ],
            "cloudflare",
            scope,
        )
    return out


def parse_traffic(data: Any) -> list[Metric]:
    """httpRequests1hGroups -> requests/bytes/cache/page views/threats/uniques.

    Sums the hourly groups (one row per returned hour) into a single window.
    """
    totals: dict[str, float] = {}
    uniques: Optional[float] = None
    for row in _rows(data, "zones", "httpRequests1hGroups"):
        s = row.get("sum") if isinstance(row.get("sum"), dict) else {}
        for k in ("requests", "bytes", "cachedRequests", "cachedBytes", "pageViews", "threats"):
            v = _num(s.get(k))
            if v is not None:
                totals[k] = totals.get(k, 0.0) + v
        u = row.get("uniq") if isinstance(row.get("uniq"), dict) else {}
        uv = _num(u.get("uniques"))
        if uv is not None:
            uniques = (uniques or 0.0) + uv

    out: list[Metric] = []
    scope = "zone"
    _emit(
        out,
        totals,
        [
            ("requests", "http_requests", "count", None),
            ("bytes", "http_bytes", "bytes", None),
            ("cachedRequests", "http_cached_requests", "count", None),
            ("pageViews", "http_page_views", "count", None),
            ("threats", "http_threats", "count", None),
        ],
        "cloudflare",
        scope,
    )
    req = totals.get("requests")
    cached = totals.get("cachedRequests")
    if req and req > 0 and cached is not None:
        out.append(
            Metric("cloudflare", "cache_hit_ratio", round(cached / req, 4), "ratio", scope=scope)
        )
    if uniques is not None:
        out.append(Metric("cloudflare", "http_unique_visitors", uniques, "count", scope=scope))
    return out


# RUM Web-Vitals quantile fields we surface, mapped to metric names + the
# Core-Web-Vitals good/needs-improvement/poor thresholds (warn, crit) so the
# Vitals tile is actionable (needs-improvement -> warn, poor -> crit). Data-driven
# so a field the account/schema does not expose is simply skipped.
_VITALS_FIELDS: list[tuple[str, str, str, float, float]] = [
    ("largestContentfulPaintP75", "lcp_p75", "ms", 2500, 4000),
    ("firstContentfulPaintP75", "fcp_p75", "ms", 1800, 3000),
    ("firstInputDelayP75", "fid_p75", "ms", 100, 300),
    ("interactionToNextPaintP75", "inp_p75", "ms", 200, 500),
    ("cumulativeLayoutShiftP75", "cls_p75", "ratio", 0.1, 0.25),
]


def parse_vitals(data: Any) -> list[Metric]:
    """rumPerformanceEventsAdaptiveGroups -> Core Web Vitals p75 (site-level).

    Reads the newest group's `quantiles`; also emits the pageload sample count.
    """
    rows = _rows(data, "accounts", "rumPerformanceEventsAdaptiveGroups")
    if not rows:
        return []
    row = rows[0]
    out: list[Metric] = []
    scope = "site"
    q = row.get("quantiles") if isinstance(row.get("quantiles"), dict) else {}
    for field, metric, unit, warn, crit in _VITALS_FIELDS:
        v = _num(q.get(field))
        if v is not None:
            out.append(
                Metric(
                    "vitals", metric, v, unit, scope=scope,
                    status=_worse_status(v, warn, crit),
                )
            )
    cnt = _num(row.get("count"))
    if cnt is not None:
        out.append(Metric("vitals", "pageload_samples", cnt, "count", scope=scope))
    return out


def parse_d1(data: Any) -> list[Metric]:
    """d1AnalyticsAdaptiveGroups -> rows read/written + query counts.

    Sums the `sum` block across the returned groups.
    """
    totals: dict[str, float] = {}
    for row in _rows(data, "accounts", "d1AnalyticsAdaptiveGroups"):
        s = row.get("sum") if isinstance(row.get("sum"), dict) else {}
        for k in ("readQueries", "writeQueries", "rowsRead", "rowsWritten", "queryBatchResponseBytes"):
            v = _num(s.get(k))
            if v is not None:
                totals[k] = totals.get(k, 0.0) + v
    out: list[Metric] = []
    _emit(
        out,
        totals,
        [
            ("readQueries", "d1_read_queries", "count", None),
            ("writeQueries", "d1_write_queries", "count", None),
            ("rowsRead", "d1_rows_read", "count", None),
            ("rowsWritten", "d1_rows_written", "count", None),
            ("queryBatchResponseBytes", "d1_response_bytes", "bytes", None),
        ],
        "database",
        "d1",
    )
    return out
