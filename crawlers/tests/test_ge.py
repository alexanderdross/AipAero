"""Unit tests for the Georgia crawler (Sakaeronavigatsia eurocontrol eAIP).

Covers the edition-by-date resolution off the eAIP history page, the
deterministic UG menu-frame URL construction, and the hyphen-separated
per-chapter section-id regex airnav.ge uses (`iAD-2-<ICAO>details`). No network
- the live fetch + AD-2 parse + title/chart enrichment are exercised by the
live test.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import ge as ge_module
from crawlers.ge import GE


@pytest.fixture
def ge() -> GE:
    crawler = GE()
    yield crawler
    crawler.close()


# The eAIP history page lists each issue's index at a date-stamped folder
# (current scheme <YYYY-MM-DD>-000000; older archives use -AIRAC). Relative
# hrefs, as airnav.ge serves them.
_HISTORY = """
<a href="2026-07-09-000000/html/index-en-GB.html">Currently effective</a>
<a href="2026-04-16-000000/html/index-en-GB.html">Previous</a>
<a href="2026-08-06-000000/html/index-en-GB.html">Future</a>
<a href="2024-12-12-AIRAC/html/index-en-GB.html">Archive</a>
<a href="https://airnav.ge/about">About</a>
"""


def test_module_root_is_airnav_ge():
    assert ge_module.ROOT_URL == "https://airnav.ge/eaip/history-en-GB.html"


def test_resolve_menu_picks_effective_edition(ge: GE):
    menu = ge._resolve_menu_url(_HISTORY, today=datetime.date(2026, 7, 15))
    # 2026-07-09 is the latest edition on/before 15 JUL 2026 (06 AUG is future).
    assert menu == (
        "https://airnav.ge/eaip/2026-07-09-000000/html/eAIP/UG-menu-en-GB.html"
    )
    # The effective edition is forwarded to crawl_meta.airac.
    assert ge.airac == "2026-07-09"


def test_resolve_menu_before_any_edition_takes_earliest(ge: GE):
    # If every edition is in the future, fall back to the earliest listed.
    menu = ge._resolve_menu_url(_HISTORY, today=datetime.date(2024, 1, 1))
    assert "2024-12-12-AIRAC/html/eAIP/UG-menu-en-GB.html" in menu


def test_resolve_menu_no_edition_raises(ge: GE):
    with pytest.raises(ValueError):
        ge._resolve_menu_url("<html><a href='/x'>nothing</a></html>")


def test_chapter_regex_matches_airnav_hyphen_ids():
    # airnav.ge keys aerodrome chapters as `iAD-2-<ICAO>details` (hyphen, not
    # the "AD 2.<ICAO>" dot form) - the regex must capture the ICAO.
    for icao in ("UGTB", "UGKO", "UGSB", "UGMS"):
        m = ge_module._AD2_CHAPTER_RE.search(f"iAD-2-{icao}details")
        assert m and m.group(1) == icao
