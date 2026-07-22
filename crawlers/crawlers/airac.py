"""AIRAC cycle date arithmetic - the single source of truth.

Kept dependency-free (stdlib ``datetime`` only) so it can be imported by the
crawler code AND by the GitHub Actions crawl gate with a plain ``python3 -c``,
without ``uv sync`` / third-party deps. ``http_base`` re-exports these names,
so ``from crawlers.http_base import current_airac_date`` keeps working.

The AIRAC cycle is a fixed 28-day schedule with published effective dates. The
AIP content upstream is static between two effective dates by design, so the
crawl schedule is driven off this math rather than run blindly every day.
"""

from __future__ import annotations

import datetime

# Fixed 28-day AIRAC cycle anchor (a real AIRAC effective date). Every date
# below is derived from this by 28-day arithmetic.
_AIRAC_ANCHOR = datetime.date(2026, 7, 9)

# Days after an AIRAC effective date on which we still run the full crawl, to
# catch national sources that publish the new edition a day or two late.
_AIRAC_CATCHUP_DAYS = 2

# Weekly safety-net crawl weekday (Monday=0 .. Sunday=6). A mid-cycle run that
# catches off-cycle NON-AIRAC amendments (some states publish them), refreshes
# the per-country "last updated" stamp, and preserves the transient-outage
# resilience the old daily crawl provided.
_SAFETY_WEEKDAY = 6  # Sunday


def current_airac_date(today: datetime.date | None = None) -> str:
    """ISO date of the AIRAC cycle currently in effect (most recent 28-day
    boundary on/before today)."""
    today = today or datetime.date.today()
    n = (today - _AIRAC_ANCHOR).days // 28
    return (_AIRAC_ANCHOR + datetime.timedelta(days=n * 28)).isoformat()


def next_airac_date(today: datetime.date | None = None) -> str:
    """ISO date of the NEXT AIRAC cycle (first 28-day boundary strictly after
    today)."""
    today = today or datetime.date.today()
    n = (today - _AIRAC_ANCHOR).days // 28
    return (_AIRAC_ANCHOR + datetime.timedelta(days=(n + 1) * 28)).isoformat()


def is_crawl_day(today: datetime.date | None = None) -> tuple[bool, str]:
    """Whether the full country crawl should run today, with a human reason.

    Returns ``(True, reason)`` on an AIRAC effective date, on the
    ``_AIRAC_CATCHUP_DAYS`` days right after it, and on the weekly safety day;
    ``(False, reason)`` on a plain mid-cycle day. The reason string is logged
    by the crawl workflow gate. A manual ``workflow_dispatch`` run bypasses
    this gate entirely (handled in ``.github/workflows/crawl.yml``).
    """
    today = today or datetime.date.today()
    days_into_cycle = (today - _AIRAC_ANCHOR).days % 28
    if days_into_cycle <= _AIRAC_CATCHUP_DAYS:
        return True, (
            f"AIRAC window (effective {current_airac_date(today)}, "
            f"+{days_into_cycle}d)"
        )
    if today.weekday() == _SAFETY_WEEKDAY:
        return True, "weekly safety-net crawl"
    return False, (
        f"mid-cycle day (+{days_into_cycle}d); next AIRAC {next_airac_date(today)}"
    )
