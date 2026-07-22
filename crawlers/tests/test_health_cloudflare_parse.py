"""Unit tests for the pure Cloudflare GraphQL response mappers.

Fixture-driven (no network), mirroring the website's openaip-parse tests: they
prove the mapping logic AND the defensive behaviour (missing/renamed fields ->
fewer metrics, never a crash)."""

from __future__ import annotations

from health.cloudflare_parse import (
    parse_d1,
    parse_traffic,
    parse_vitals,
    parse_workers,
)


def _by_metric(metrics):
    return {m.metric: m for m in metrics}


# --- workers ---------------------------------------------------------------


def test_parse_workers_happy_path():
    data = {
        "data": {
            "viewer": {
                "accounts": [
                    {
                        "workersInvocationsAdaptive": [
                            {
                                "dimensions": {"scriptName": "aip-aero"},
                                "sum": {"requests": 1000, "errors": 5, "subrequests": 200},
                                "quantiles": {"cpuTimeP50": 12.5, "cpuTimeP99": 80.0},
                            }
                        ]
                    }
                ]
            }
        }
    }
    m = _by_metric(parse_workers(data))
    assert m["worker_requests"].value == 1000
    assert m["worker_errors"].value == 5
    assert m["worker_subrequests"].value == 200
    assert m["worker_cpu_p50_ms"].value == 12.5
    assert m["worker_cpu_p99_ms"].value == 80.0
    # error rate = 5/1000 = 0.005 -> ok (< 1%)
    assert m["worker_requests"].scope == "aip-aero"
    assert abs(m["worker_error_rate"].value - 0.005) < 1e-9
    assert m["worker_error_rate"].status == "ok"


def test_parse_workers_high_error_rate_warns():
    data = {
        "data": {"viewer": {"accounts": [{"workersInvocationsAdaptive": [
            {"dimensions": {"scriptName": "aip-aero"}, "sum": {"requests": 100, "errors": 5}, "quantiles": {}}
        ]}]}}
    }
    m = _by_metric(parse_workers(data))
    assert m["worker_error_rate"].status == "warn"  # 5% >= 1%


def test_parse_workers_zero_requests_no_rate():
    data = {
        "data": {"viewer": {"accounts": [{"workersInvocationsAdaptive": [
            {"dimensions": {"scriptName": "aip-aero"}, "sum": {"requests": 0, "errors": 0}, "quantiles": {}}
        ]}]}}
    }
    m = _by_metric(parse_workers(data))
    assert "worker_error_rate" not in m  # no divide-by-zero metric


# --- traffic ---------------------------------------------------------------


def test_parse_traffic_sums_hourly_groups():
    data = {
        "data": {"viewer": {"zones": [{"httpRequests1hGroups": [
            {"sum": {"requests": 100, "bytes": 5000, "cachedRequests": 60, "pageViews": 40, "threats": 1}, "uniq": {"uniques": 30}},
            {"sum": {"requests": 100, "bytes": 5000, "cachedRequests": 40, "pageViews": 20, "threats": 0}, "uniq": {"uniques": 20}},
        ]}]}}
    }
    m = _by_metric(parse_traffic(data))
    assert m["http_requests"].value == 200
    assert m["http_bytes"].value == 10000
    assert m["http_cached_requests"].value == 100
    assert m["http_page_views"].value == 60
    assert m["http_threats"].value == 1
    assert m["http_unique_visitors"].value == 50
    # cache hit ratio = 100/200 = 0.5
    assert abs(m["cache_hit_ratio"].value - 0.5) < 1e-9
    assert m["http_requests"].scope == "zone"


# --- vitals ----------------------------------------------------------------


def test_parse_vitals_reads_p75_quantiles():
    data = {
        "data": {"viewer": {"accounts": [{"rumPerformanceEventsAdaptiveGroups": [
            {"count": 1234, "quantiles": {
                "largestContentfulPaintP75": 2100.0,
                "firstContentfulPaintP75": 900.0,
                "cumulativeLayoutShiftP75": 0.03,
            }}
        ]}]}}
    }
    m = _by_metric(parse_vitals(data))
    assert m["lcp_p75"].value == 2100.0
    assert m["lcp_p75"].category == "vitals"
    assert m["fcp_p75"].value == 900.0
    assert m["cls_p75"].value == 0.03
    assert m["pageload_samples"].value == 1234
    # fields the account didn't expose are simply absent (defensive)
    assert "inp_p75" not in m


# --- d1 --------------------------------------------------------------------


def test_parse_d1_sums_groups():
    data = {
        "data": {"viewer": {"accounts": [{"d1AnalyticsAdaptiveGroups": [
            {"sum": {"readQueries": 10, "writeQueries": 2, "rowsRead": 500, "rowsWritten": 8, "queryBatchResponseBytes": 12000}},
            {"sum": {"readQueries": 5, "writeQueries": 1, "rowsRead": 100, "rowsWritten": 2, "queryBatchResponseBytes": 3000}},
        ]}]}}
    }
    m = _by_metric(parse_d1(data))
    assert m["d1_read_queries"].value == 15
    assert m["d1_rows_read"].value == 600
    assert m["d1_rows_written"].value == 10
    assert m["d1_response_bytes"].value == 15000
    assert m["d1_read_queries"].category == "database"
    assert m["d1_read_queries"].scope == "d1"


# --- defensive / malformed inputs ------------------------------------------


def test_all_parsers_tolerate_empty_and_malformed():
    for bad in [
        {},
        None,
        {"data": None},
        {"data": {"viewer": {}}},
        {"data": {"viewer": {"accounts": []}}},
        {"data": {"viewer": {"accounts": [{}]}}},
        {"data": {"viewer": {"accounts": [{"workersInvocationsAdaptive": [{"sum": None}]}]}}},
        {"errors": [{"message": "boom"}]},
    ]:
        assert parse_workers(bad) == [] or isinstance(parse_workers(bad), list)
        assert isinstance(parse_traffic(bad), list)
        assert isinstance(parse_vitals(bad), list)
        assert isinstance(parse_d1(bad), list)


def test_non_numeric_values_skipped():
    data = {
        "data": {"viewer": {"accounts": [{"workersInvocationsAdaptive": [
            {"dimensions": {"scriptName": "x"}, "sum": {"requests": "not-a-number", "errors": None}, "quantiles": {"cpuTimeP50": "bad"}}
        ]}]}}
    }
    # No numeric fields -> no metrics, no exception.
    assert parse_workers(data) == []
