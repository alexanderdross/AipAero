"""Tests for the pure health-alert decision logic (decide_alerts).

The debounce policy is the safety-relevant part (no alert storm, no missed crit),
so it is unit-tested against Metric fixtures; the ntfy send is thin/fail-soft I/O.
"""

from __future__ import annotations

from health.alert import decide_alerts
from health.models import Metric

COOLDOWN = 6 * 3600


def _crit(metric="ram_used_pct", cat="server", scope=None, value=97):
    return Metric(cat, metric, value, "pct", scope=scope, status="crit")


def _ok(metric="ram_used_pct", cat="server", scope=None, value=40):
    return Metric(cat, metric, value, "pct", scope=scope, status="ok")


def test_entering_crit_alerts():
    alerts, state = decide_alerts([_crit()], {}, now=1000, cooldown_s=COOLDOWN)
    assert len(alerts) == 1
    assert alerts[0]["kind"] == "crit"
    assert "server/ram_used_pct" in alerts[0]["text"]
    assert state["server/ram_used_pct"] == {"status": "crit", "ts": 1000}


def test_sustained_crit_within_cooldown_is_silent():
    prev = {"server/ram_used_pct": {"status": "crit", "ts": 1000}}
    alerts, state = decide_alerts(
        [_crit()], prev, now=1000 + COOLDOWN - 1, cooldown_s=COOLDOWN
    )
    assert alerts == []
    # last-alert ts preserved so the cooldown measures from the alert
    assert state["server/ram_used_pct"]["ts"] == 1000


def test_sustained_crit_after_cooldown_realerts():
    prev = {"server/ram_used_pct": {"status": "crit", "ts": 1000}}
    alerts, state = decide_alerts(
        [_crit()], prev, now=1000 + COOLDOWN, cooldown_s=COOLDOWN
    )
    assert len(alerts) == 1 and alerts[0]["kind"] == "crit"
    assert state["server/ram_used_pct"]["ts"] == 1000 + COOLDOWN


def test_recovery_from_crit_alerts_once():
    prev = {"server/ram_used_pct": {"status": "crit", "ts": 1000}}
    alerts, state = decide_alerts([_ok()], prev, now=2000, cooldown_s=COOLDOWN)
    assert len(alerts) == 1 and alerts[0]["kind"] == "recovered"
    assert state["server/ram_used_pct"] == {"status": "ok", "ts": 2000}
    # a subsequent ok run does not re-alert
    alerts2, _ = decide_alerts([_ok()], state, now=3000, cooldown_s=COOLDOWN)
    assert alerts2 == []


def test_warn_and_ok_never_alert():
    warn = Metric("server", "disk_used_pct", 88, "pct", status="warn")
    alerts, _ = decide_alerts([warn, _ok()], {}, now=1000, cooldown_s=COOLDOWN)
    assert alerts == []


def test_scope_is_part_of_the_key():
    alerts, state = decide_alerts(
        [_crit(cat="crawl", metric="crawl_ok", scope="GR", value=0)],
        {},
        now=1000,
        cooldown_s=COOLDOWN,
    )
    assert alerts[0]["key"] == "crawl/crawl_ok/GR"
    assert "crawl/crawl_ok/GR" in state


def test_unseen_keys_are_pruned_from_state():
    prev = {"server/old_metric": {"status": "crit", "ts": 500}}
    _, state = decide_alerts([_ok()], prev, now=1000, cooldown_s=COOLDOWN)
    assert "server/old_metric" not in state  # not seen this run -> dropped


def test_statusless_metrics_ignored():
    m = Metric("server", "ram_used_bytes", 123, "bytes")  # status=None
    alerts, state = decide_alerts([m], {}, now=1000, cooldown_s=COOLDOWN)
    assert alerts == [] and state == {}
