"""Unit tests for the Sweden crawler's edition picker + eAIP entry finder."""

from __future__ import annotations

import datetime

import pytest

from crawlers.se import SE

BASE = "https://aro.lfv.se/"
LANDING = """
<a href="content/eaip/2026_05_14/index-en-GB.html">14 May</a>
<a href="content/eaip/2026_06_11/index-en-GB.html">11 Jun</a>
<a href="content/eaip/2026_07_09/index-en-GB.html">09 Jul</a>
"""


@pytest.fixture
def crawler() -> SE:
    c = SE()
    yield c
    c.close()


def test_picks_current_before_next_cycle(crawler: SE):
    url = crawler._resolve_edition_url(BASE, LANDING, today=datetime.date(2026, 7, 8))
    assert "2026_06_11" in url


def test_switches_on_effective_date(crawler: SE):
    url = crawler._resolve_edition_url(BASE, LANDING, today=datetime.date(2026, 7, 9))
    assert "2026_07_09" in url


def test_all_future_falls_back_to_earliest(crawler: SE):
    url = crawler._resolve_edition_url(BASE, LANDING, today=datetime.date(2026, 1, 1))
    assert "2026_05_14" in url


def test_find_eaip_entry_returns_first_content_eaip_link(crawler: SE):
    html = (
        '<a href="/misc/other.html">Other</a>'
        '<a href="content/eaip/default_offline.html">EAIP</a>'
    )
    url = crawler._find_eaip_entry(BASE, html)
    assert url is not None and url.endswith("content/eaip/default_offline.html")


def test_find_eaip_entry_none_when_absent(crawler: SE):
    assert crawler._find_eaip_entry(BASE, "<a href='/x.html'>x</a>") is None
