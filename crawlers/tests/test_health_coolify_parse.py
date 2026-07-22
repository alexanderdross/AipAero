"""Unit tests for the pure Coolify resources -> Metric mapper."""

from __future__ import annotations

from health.coolify_parse import parse_resources


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
