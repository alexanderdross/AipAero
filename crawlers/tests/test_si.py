"""Unit tests for the Slovenia crawler's edition entry resolver.

SI's AMDT history page lists dated `index*.html` editions; the resolver picks
the latest in effect on/before today, falls back to an undated index, else
raises.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers.si import SI

HISTORY = """
<a href="2026-05-14-AIRAC/html/index-en-GB.html">14 May</a>
<a href="2026-06-11-AIRAC/html/index-en-GB.html">11 Jun</a>
<a href="2026-07-09-AIRAC/html/index-en-GB.html">09 Jul</a>
"""


@pytest.fixture
def crawler() -> SI:
    c = SI()
    yield c
    c.close()


def test_picks_current_before_next_cycle(crawler: SI):
    url = crawler._resolve_edition_entry(HISTORY, today=datetime.date(2026, 7, 8))
    assert "2026-06-11" in url


def test_switches_on_effective_date(crawler: SI):
    url = crawler._resolve_edition_entry(HISTORY, today=datetime.date(2026, 7, 9))
    assert "2026-07-09" in url


def test_all_future_falls_back_to_earliest(crawler: SI):
    url = crawler._resolve_edition_entry(HISTORY, today=datetime.date(2026, 1, 1))
    assert "2026-05-14" in url


def test_undated_index_is_the_fallback(crawler: SI):
    url = crawler._resolve_edition_entry(
        "<a href='html/index-en-GB.html'>Current</a>",
        today=datetime.date(2026, 7, 8),
    )
    assert url.endswith("index-en-GB.html")


def test_no_index_links_raises(crawler: SI):
    with pytest.raises(ValueError):
        crawler._resolve_edition_entry(
            "<a href='about.html'>x</a>", today=datetime.date(2026, 7, 8)
        )
