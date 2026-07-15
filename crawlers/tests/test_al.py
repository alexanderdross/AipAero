"""Unit tests for the Albania crawler (Albcontrol eurocontrol eAIP).

Covers the edition-by-date resolution off the /aip/ landing page and the
deterministic menu-frame URL construction (no network - the live fetch +
AD-2 parse are exercised by the live test).
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import al as al_module
from crawlers.al import AL


@pytest.fixture
def al() -> AL:
    crawler = AL()
    yield crawler
    crawler.close()


_LANDING = """
<a href="/al/aip/20-MAY-2026-NA/2026-05-20-NON-AIRAC/html">Current Version</a>
<a href="/al/aip/06-AUG-2026-A/2026-08-06-AIRAC/html">Future Version</a>
<a href="/al/aip/09-APR-2026-A/2026-04-09-AIRAC/html">Old Version</a>
<a href="https://www.albcontrol.al/vacancies/">Vacancies</a>
"""


def test_module_root_is_albcontrol():
    assert al_module.ROOT_URL == "https://www.albcontrol.al/aip/"


def test_resolve_menu_picks_effective_edition(al: AL):
    menu = al._resolve_menu_url(_LANDING, today=datetime.date(2026, 7, 15))
    # 20 MAY 2026 is the latest edition on/before 15 JUL 2026 (06 AUG is future).
    assert menu == (
        "https://www.albcontrol.al/al/aip/20-MAY-2026-NA/"
        "2026-05-20-NON-AIRAC/html/eAIP/LA-menu-en-GB.html"
    )


def test_resolve_menu_before_any_edition_takes_earliest(al: AL):
    # If every edition is in the future, fall back to the earliest listed.
    menu = al._resolve_menu_url(_LANDING, today=datetime.date(2026, 1, 1))
    assert "2026-04-09-AIRAC/html/eAIP/LA-menu-en-GB.html" in menu


def test_resolve_menu_no_edition_raises(al: AL):
    with pytest.raises(ValueError):
        al._resolve_menu_url("<html><a href='/x'>nothing</a></html>")
