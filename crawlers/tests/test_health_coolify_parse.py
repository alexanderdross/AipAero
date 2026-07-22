"""Unit tests for the pure Coolify resources -> Metric mapper."""

from __future__ import annotations

from health.coolify_parse import parse_resources, parse_servers


def _by_metric(metrics):
    return {m.metric: m for m in metrics}


def test_all_running_healthy_is_ok():
    data = [
        {"name": "web", "status": "running:healthy"},
        {"name": "db", "status": "running:healthy"},
    ]
    m = _by_metric(parse_resources(data))
    assert m["resources_total"].value == 2
    assert m["resources_running"].value == 2
    assert m["resources_running"].status == "ok"
    assert m["resources_unhealthy"].value == 0
    assert m["resources_unhealthy"].status == "ok"
    assert m["resources_stopped"].value == 0


def test_unhealthy_is_crit_and_names_in_meta():
    data = [
        {"name": "web", "status": "running:healthy"},
        {"name": "worker", "status": "running:unhealthy"},
    ]
    m = _by_metric(parse_resources(data))
    # running counts both (both have state "running")
    assert m["resources_running"].value == 2
    unhealthy = m["resources_unhealthy"]
    assert unhealthy.value == 1
    assert unhealthy.status == "crit"
    assert unhealthy.meta == {"names": ["worker"]}


def test_stopped_is_warn():
    data = [
        {"name": "web", "status": "running:healthy"},
        {"name": "old", "status": "exited:unhealthy"},
    ]
    m = _by_metric(parse_resources(data))
    assert m["resources_running"].value == 1
    assert m["resources_running"].status == "warn"  # not all running
    assert m["resources_stopped"].value == 1
    assert m["resources_stopped"].status == "warn"
    # exited:unhealthy also counts as unhealthy
    assert m["resources_unhealthy"].value == 1


def test_name_falls_back_to_fqdn_or_uuid():
    data = [{"uuid": "abc123", "status": "running:unhealthy"}]
    m = _by_metric(parse_resources(data))
    assert m["resources_unhealthy"].meta == {"names": ["abc123"]}


def test_defensive_on_malformed():
    for bad in [None, {}, "nope", [None, 42, {"status": None}]]:
        out = parse_resources(bad)
        assert isinstance(out, list)
    # a non-list yields nothing
    assert parse_resources({"not": "a list"}) == []
    # a list with one odd entry still totals 1 and never raises
    m = _by_metric(parse_resources([{"status": None}]))
    assert m["resources_total"].value == 1


# --- parse_servers ---------------------------------------------------------


def _server_metrics(metrics):
    """(scope, metric) -> Metric."""
    return {(m.scope, m.metric): m for m in metrics}


def test_parse_servers_flat_percent_fields():
    data = [{"name": "netcup", "cpu": 42, "memory": 71.5, "disk": 88}]
    m = _server_metrics(parse_servers(data))
    assert m[("netcup", "cpu_used_pct")].value == 42
    assert m[("netcup", "cpu_used_pct")].unit == "pct"
    assert m[("netcup", "ram_used_pct")].value == 71.5
    assert m[("netcup", "disk_used_pct")].value == 88
    # all < 90 -> ok
    assert all(v.status == "ok" for v in m.values())


def test_parse_servers_nested_usage_and_high_is_warn():
    data = [{"name": "box2", "usage": {"cpu_usage": 95, "disk_usage": 30}}]
    m = _server_metrics(parse_servers(data))
    assert m[("box2", "cpu_used_pct")].value == 95
    assert m[("box2", "cpu_used_pct")].status == "warn"  # >= 90
    assert m[("box2", "disk_used_pct")].value == 30


def test_parse_servers_ratio_scaled_to_percent():
    data = [{"name": "r", "memory_usage": 0.5}]
    m = _server_metrics(parse_servers(data))
    assert m[("r", "ram_used_pct")].value == 50.0


def test_parse_servers_skips_when_no_usage_fields():
    # A server payload with only config (no usage) yields no per-server metrics.
    data = [{"name": "cfg-only", "ip": "1.2.3.4", "uuid": "abc"}]
    assert parse_servers(data) == []


def test_parse_servers_defensive():
    for bad in [None, {}, "x", [None, 5, {"cpu": "high"}]]:
        assert isinstance(parse_servers(bad), list)
    # non-numeric usage is ignored (never a wrong value)
    assert parse_servers([{"name": "n", "cpu": "high"}]) == []
