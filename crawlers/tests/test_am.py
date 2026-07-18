"""Unit tests for the Armenia crawler (ARMATS eurocontrol eAIP).

Covers the edition-by-date resolution off the eAIP landing page (the dated
`storage/attachments/<id>-<amdt>(<DDMONYYYY>)/index.html` links) and the
deterministic UD menu-frame URL construction. No network - the live fetch +
AD-2 parse + title/chart enrichment are exercised by the live test.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import am as am_module
from crawlers.am import AM


@pytest.fixture
def am() -> AM:
    crawler = AM()
    yield crawler
    crawler.close()


# The eAIP landing lists each edition as a dated static index.html link.
_LANDING = """
<a href="/storage/attachments/178126463302-26(09JUL2026)/index.html">02-26 (09JUL2026)</a>
<a href="/storage/attachments/177919028001-26(19FEB2026)/index.html">01-26 (19FEB2026)</a>
<a href="/storage/attachments/177029564006-25(25DEC2025)/index.html">06-25 (25DEC2025)</a>
<a href="/storage/attachments/999999999999-27(06AUG2026)/index.html">Future (06AUG2026)</a>
<a href="https://armats.am/login">Login</a>
"""


def test_module_root_is_armats():
    assert am_module.ROOT_URL == "https://armats.am/activities/ais/eaip"


def test_resolve_menu_picks_effective_edition(am: AM):
    menu = am._resolve_menu_url(_LANDING, today=datetime.date(2026, 7, 15))
    # 09 JUL 2026 is the latest edition on/before 15 JUL 2026 (06 AUG is future).
    assert menu == (
        "https://armats.am/storage/attachments/178126463302-26(09JUL2026)/"
        "html/eAIP/UD-menu-en-GB.html"
    )
    assert am.airac == "2026-07-09"


def test_resolve_menu_before_any_edition_takes_earliest(am: AM):
    menu = am._resolve_menu_url(_LANDING, today=datetime.date(2025, 1, 1))
    assert "177029564006-25(25DEC2025)/html/eAIP/UD-menu-en-GB.html" in menu


def test_resolve_menu_no_edition_raises(am: AM):
    with pytest.raises(ValueError):
        am._resolve_menu_url("<html><a href='/x'>nothing</a></html>")
