"""Unit tests for the Norway crawler's edition picker + redirect fallbacks."""

from __future__ import annotations

import datetime

import pytest

from crawlers.no import NO

BASE = "https://aim-prod.avinor.no/no/AIP/"
LANDING = """
<a href="2026-05-14-AIRAC/html/index-no-NO.html">14 May</a>
<a href="2026-06-11-AIRAC/html/index-no-NO.html">11 Jun</a>
<a href="2026-07-09-AIRAC/html/index-no-NO.html">09 Jul</a>
"""


@pytest.fixture
def crawler() -> NO:
    c = NO()
    yield c
    c.close()


def test_picks_current_before_next_cycle(crawler: NO):
    url = crawler._resolve_edition_url(BASE, LANDING, today=datetime.date(2026, 7, 8))
    assert "2026-06-11-AIRAC" in url


def test_switches_on_effective_date(crawler: NO):
    url = crawler._resolve_edition_url(BASE, LANDING, today=datetime.date(2026, 7, 9))
    assert "2026-07-09-AIRAC" in url


def test_all_future_falls_back_to_earliest(crawler: NO):
    url = crawler._resolve_edition_url(BASE, LANDING, today=datetime.date(2026, 1, 1))
    assert "2026-05-14-AIRAC" in url


def test_meta_refresh_fallback_when_no_dated_links(crawler: NO):
    html = '<meta http-equiv="refresh" content="0; url=html/index-en-GB.html">'
    url = crawler._resolve_edition_url(BASE, html, today=datetime.date(2026, 7, 8))
    assert url.endswith("/html/index-en-GB.html")


def test_returns_base_url_when_nothing_resolvable(crawler: NO):
    url = crawler._resolve_edition_url(
        BASE, "<html><body>nothing</body></html>", today=datetime.date(2026, 7, 8)
    )
    assert url == BASE
