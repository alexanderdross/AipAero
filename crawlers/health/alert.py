"""Health alerting - notify when a metric goes crit.

Until now `crit` only tinted a pixel on a dashboard nobody may be watching. This
module turns a crit sample into an actual push (ntfy), with a debounce so a
sustained crit does not re-alert every 15-min run.

Split like the rest of the health package: `decide_alerts()` is PURE (metrics +
previous state + now -> the notifications to send + the next state), so the
policy is unit-testable; `send_ntfy()` / `run_alerts()` are the thin, fail-soft
I/O wrappers. Inert without `alert_ntfy_url` (no channel -> never notifies).

Policy (deliberately low-noise):
- alert when a metric ENTERS crit,
- re-alert only after the cooldown while it STAYS crit,
- send a recovery note when a previously-crit metric returns to ok/warn,
- `warn` is never alerted (visual only) - only `crit` and its recovery.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from .models import Metric
from .settings import HealthSettings

log = logging.getLogger(__name__)


def _key(m: Metric) -> str:
    """Stable per-series key (matches the dashboard's crit label)."""
    return f"{m.category}/{m.metric}" + (f"/{m.scope}" if m.scope else "")


def _fmt_value(m: Metric) -> str:
    if m.value is None:
        return "-"
    return f"{m.value:g}{(' ' + m.unit) if m.unit else ''}"


def decide_alerts(
    metrics: list[Metric],
    prev_state: dict[str, dict[str, Any]],
    now: int,
    cooldown_s: int,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Decide which notifications to send and the next debounce state. Pure.

    `prev_state`/return state: {key: {"status": "crit"|"ok"|..., "ts": int}} where
    `ts` is the time of the LAST alert for that key (used for the cooldown). Each
    returned alert is {"key", "kind": "crit"|"recovered", "text"}.
    """
    alerts: list[dict[str, Any]] = []
    new_state: dict[str, dict[str, Any]] = {}
    seen: set[str] = set()

    for m in metrics:
        if m.status not in ("crit", "warn", "ok"):
            continue  # statusless metrics can't alert
        key = _key(m)
        if key in seen:
            continue  # first sample per key wins (stable)
        seen.add(key)
        prev = prev_state.get(key) or {}
        prev_status = prev.get("status")
        prev_ts = prev.get("ts")

        if m.status == "crit":
            entered = prev_status != "crit"
            cooled = (
                not entered
                and isinstance(prev_ts, int)
                and now - prev_ts >= cooldown_s
            )
            if entered or cooled:
                alerts.append(
                    {
                        "key": key,
                        "kind": "crit",
                        "text": f"CRIT {key} = {_fmt_value(m)}",
                    }
                )
                new_state[key] = {"status": "crit", "ts": now}
            else:
                # Still crit within the cooldown - keep the last-alert timestamp
                # so the cooldown measures from the alert, not from now.
                new_state[key] = {
                    "status": "crit",
                    "ts": prev_ts if isinstance(prev_ts, int) else now,
                }
        else:  # ok / warn
            if prev_status == "crit":
                alerts.append(
                    {
                        "key": key,
                        "kind": "recovered",
                        "text": f"RECOVERED {key} = {_fmt_value(m)} ({m.status})",
                    }
                )
            new_state[key] = {"status": m.status, "ts": now}

    # Drop keys not seen this run so the state file cannot grow unbounded; a key
    # that reappears crit later simply alerts again (a gap is worth alerting).
    new_state = {k: v for k, v in new_state.items() if k in seen}
    return alerts, new_state


def _load_state(path: str) -> dict[str, dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_state(path: str, state: dict[str, dict[str, Any]]) -> None:
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(state, fh, separators=(",", ":"))
    except OSError as e:
        log.warning("could not persist alert state to %s: %s", path, e)


def send_ntfy(url: str, title: str, message: str, priority: str = "default") -> bool:
    """POST a notification to an ntfy topic. Fail-soft (never raises)."""
    import httpx

    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.post(
                url,
                content=message.encode("utf-8"),
                headers={"Title": title, "Priority": priority},
            )
            r.raise_for_status()
        return True
    except Exception as e:
        log.error("ntfy send failed: %s", e)
        return False


def _load_subs(path: str) -> list[dict[str, Any]]:
    """Read the browser push subscriptions the dashboard persisted. Fail-soft."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save_subs(path: str, subs: list[dict[str, Any]]) -> None:
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(subs, fh, separators=(",", ":"))
    except OSError as e:
        log.warning("could not persist push subscriptions to %s: %s", path, e)


def send_webpush(settings: HealthSettings, alerts: list[dict[str, Any]]) -> int:
    """Send each alert as an encrypted Web Push to every stored subscription.

    Inert (returns 0) without a VAPID private key or no subscriptions. Dead
    subscriptions (404/410 Gone) are pruned from the file. Fully fail-soft: a
    missing pywebpush dependency or any send error never raises.
    """
    if settings.vapid_private_key is None or not alerts:
        return 0
    subs = _load_subs(settings.push_subs_file)
    if not subs:
        return 0
    try:
        from pywebpush import WebPushException, webpush
    except Exception as e:
        log.warning("pywebpush unavailable, skipping Web Push (%s)", e)
        return 0

    private_key = settings.vapid_private_key.get_secret_value()
    claims = {"sub": settings.vapid_subject}
    # One notification per crit; recoveries push too so a watcher sees the all-clear.
    sent = 0
    dead: set[str] = set()
    for a in alerts:
        crit = a["kind"] == "crit"
        payload = json.dumps(
            {
                "title": "AIP:Aero Health" + (" - kritisch" if crit else ""),
                "body": a["text"],
                "tag": a["key"],
            }
        )
        for sub in subs:
            endpoint = sub.get("endpoint")
            if not endpoint or endpoint in dead:
                continue
            try:
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=private_key,
                    vapid_claims=dict(claims),
                    timeout=10,
                )
                sent += 1
            except WebPushException as e:
                status = getattr(getattr(e, "response", None), "status_code", None)
                if status in (404, 410):
                    dead.add(endpoint)  # subscription gone -> prune below
                else:
                    log.warning("web push failed (%s): %s", status, e)
            except Exception as e:
                log.warning("web push error: %s", e)
    if dead:
        _save_subs(settings.push_subs_file, [s for s in subs if s.get("endpoint") not in dead])
        log.info("pruned %d dead push subscription(s)", len(dead))
    return sent


def run_alerts(
    settings: HealthSettings, metrics: list[Metric], now: int
) -> list[dict[str, Any]]:
    """Load state, decide, notify (ntfy + Web Push), persist. Returns the alerts.

    Inert (returns []) when NO channel is configured (neither ntfy nor a VAPID
    key), so it is safe to always call. Fully fail-soft - an alerting error never
    affects the collector run.
    """
    if not settings.alert_ntfy_url and settings.vapid_private_key is None:
        return []
    try:
        cooldown_s = int(settings.alert_cooldown_hours * 3600)
        state = _load_state(settings.alert_state_file)
        alerts, new_state = decide_alerts(metrics, state, now, cooldown_s)
        if settings.alert_ntfy_url:
            for a in alerts:
                priority = "high" if a["kind"] == "crit" else "default"
                send_ntfy(
                    settings.alert_ntfy_url, "AIP:Aero Health", a["text"], priority
                )
        pushed = send_webpush(settings, alerts)
        _save_state(settings.alert_state_file, new_state)
        if alerts:
            log.info("sent %d health alert(s) (%d web push)", len(alerts), pushed)
        return alerts
    except Exception:
        log.exception("alerting failed (non-fatal)")
        return []
