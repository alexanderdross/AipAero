"""Unit tests for the Latvia crawler's dated eAIP edition picker."""

from __future__ import annotations

import datetime

import pytest

from crawlers.lv import LV

LANDING = """
<a href="eAIPfiles/2026_003/data/2026-05-14/html/index-en-GB.html">14 May</a>
<a href="eAIPfiles/2026_005/data/2026-06-11/html/index-en-GB.html">11 Jun</a>
<a href="eAIPfiles/2026_006/data/2026-07-09/html/index-en-GB.html">09 Jul</a>
<a href="about.html">About</a>
"""


@pytest.fixture
def crawler() -> LV:
    c = LV()
    yield c
    c.close()


def test_picks_current_before_next_cycle(crawler: LV):
    url = crawler._resolve_edition_url(LANDING, today=datetime.date(2026, 7, 8))
    assert "2026-06-11" in url


def test_switches_on_effective_date(crawler: LV):
    url = crawler._resolve_edition_url(LANDING, today=datetime.date(2026, 7, 9))
    assert "2026-07-09" in url


def test_all_future_falls_back_to_earliest(crawler: LV):
    url = crawler._resolve_edition_url(LANDING, today=datetime.date(2026, 1, 1))
    assert "2026-05-14" in url


def test_returned_url_is_absolute(crawler: LV):
    url = crawler._resolve_edition_url(LANDING, today=datetime.date(2026, 7, 8))
    assert url.startswith("https://ais.lgs.lv/")


def test_no_edition_links_raises(crawler: LV):
    with pytest.raises(ValueError):
        crawler._resolve_edition_url(
            "<a href='about.html'>x</a>", today=datetime.date(2026, 7, 8)
        )
