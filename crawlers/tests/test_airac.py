"""Unit tests for the AIRAC schedule math (crawlers/crawlers/airac.py).

These drive the crawl-day gate in .github/workflows/crawl.yml, so they pin the
28-day arithmetic: the current/next effective date and which days the scheduled
crawl actually runs (effective date + catch-up days, plus the weekly safety day).
"""

from __future__ import annotations

import datetime

from crawlers.airac import (
    _AIRAC_ANCHOR,
    current_airac_date,
    is_crawl_day,
    next_airac_date,
)


def test_current_and_next_on_anchor():
    d = _AIRAC_ANCHOR
    assert current_airac_date(d) == d.isoformat()
    assert next_airac_date(d) == (d + datetime.timedelta(days=28)).isoformat()


def test_current_is_last_boundary_on_or_before():
    # 6 days into the cycle -> still the anchor edition.
    assert current_airac_date(_AIRAC_ANCHOR + datetime.timedelta(days=6)) == (
        _AIRAC_ANCHOR.isoformat()
    )


def test_gate_runs_on_effective_date():
    run, reason = is_crawl_day(_AIRAC_ANCHOR)
    assert run is True
    assert "AIRAC window" in reason


def test_gate_runs_on_catchup_days():
    for offset in (1, 2):
        run, _ = is_crawl_day(_AIRAC_ANCHOR + datetime.timedelta(days=offset))
        assert run is True, offset


def test_gate_skips_plain_midcycle_day():
    # +6 days is a Wednesday (anchor 2026-07-09 is a Thursday) - not a catch-up
    # day and not the safety weekday, so a scheduled run is skipped.
    mid = _AIRAC_ANCHOR + datetime.timedelta(days=6)
    assert mid.weekday() != 6
    run, reason = is_crawl_day(mid)
    assert run is False
    assert "mid-cycle" in reason


def test_gate_runs_on_weekly_safety_day():
    # Find the first Sunday that is NOT within the catch-up window.
    d = _AIRAC_ANCHOR + datetime.timedelta(days=3)
    while d.weekday() != 6:
        d += datetime.timedelta(days=1)
    run, reason = is_crawl_day(d)
    assert run is True
    assert "safety" in reason
