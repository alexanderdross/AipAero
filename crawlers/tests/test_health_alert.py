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


# --- Web Push (send_webpush) ------------------------------------------------

from health import alert as alert_mod  # noqa: E402
from health.settings import HealthSettings  # noqa: E402


def test_send_webpush_inert_without_key(tmp_path):
    # No VAPID private key -> Web Push is a no-op, never touches pywebpush.
    s = HealthSettings(push_subs_file=str(tmp_path / "subs.json"))
    assert s.vapid_private_key is None
    sent = alert_mod.send_webpush(s, [{"key": "server/x", "kind": "crit", "text": "CRIT"}])
    assert sent == 0


def test_send_webpush_inert_without_subs(tmp_path):
    s = HealthSettings(
        vapid_private_key="secret", push_subs_file=str(tmp_path / "missing.json")
    )
    # key set but no subscriptions file -> nothing to send
    sent = alert_mod.send_webpush(s, [{"key": "server/x", "kind": "crit", "text": "C"}])
    assert sent == 0


def test_send_webpush_sends_and_prunes_dead(tmp_path, monkeypatch):
    import json as _json

    subs_file = tmp_path / "subs.json"
    subs = [
        {"endpoint": "https://push.example/live", "keys": {"p256dh": "k", "auth": "a"}},
        {"endpoint": "https://push.example/dead", "keys": {"p256dh": "k", "auth": "a"}},
    ]
    subs_file.write_text(_json.dumps(subs), encoding="utf-8")
    s = HealthSettings(vapid_private_key="secret", push_subs_file=str(subs_file))

    calls = []

    class FakeResponse:
        def __init__(self, code):
            self.status_code = code

    class FakeWebPushException(Exception):
        def __init__(self, msg, response=None):
            super().__init__(msg)
            self.response = response

    def fake_webpush(subscription_info, data, vapid_private_key, vapid_claims, timeout):
        calls.append(subscription_info["endpoint"])
        if subscription_info["endpoint"].endswith("/dead"):
            raise FakeWebPushException("gone", response=FakeResponse(410))

    # Inject a fake pywebpush module so no real network / crypto happens.
    import types

    fake_mod = types.SimpleNamespace(
        webpush=fake_webpush, WebPushException=FakeWebPushException
    )
    monkeypatch.setitem(__import__("sys").modules, "pywebpush", fake_mod)

    sent = alert_mod.send_webpush(
        s, [{"key": "server/ram", "kind": "crit", "text": "CRIT server/ram = 97 pct"}]
    )
    assert sent == 1  # only the live endpoint counts
    assert set(calls) == {"https://push.example/live", "https://push.example/dead"}
    # the dead (410) subscription is pruned from the file
    remaining = _json.loads(subs_file.read_text(encoding="utf-8"))
    assert [x["endpoint"] for x in remaining] == ["https://push.example/live"]


def test_run_alerts_fires_on_webpush_only(tmp_path, monkeypatch):
    # No ntfy URL, but a VAPID key -> run_alerts is NOT inert (sends web push).
    s = HealthSettings(
        vapid_private_key="secret",
        push_subs_file=str(tmp_path / "subs.json"),
        alert_state_file=str(tmp_path / "state.json"),
    )
    seen = {}

    def fake_send_webpush(settings, alerts):
        seen["alerts"] = alerts
        return len(alerts)

    monkeypatch.setattr(alert_mod, "send_webpush", fake_send_webpush)
    out = alert_mod.run_alerts(s, [_crit()], now=1000)
    assert len(out) == 1 and out[0]["kind"] == "crit"
    assert seen["alerts"] == out  # web push got the same alerts
