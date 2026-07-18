"""Unit tests for the Kosovo (CAA Kosovo / ASHNA) eAIP crawler.

These cover the edition-resolution logic (`_resolve_menu_url`), including the
irregular edition-folder href format (a literal backslash and un-encoded spaces
before `index.html`), which the crawler must normalise + percent-encode when
building the eurocontrol menu URL - all without network access.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import xk as xk_module
from crawlers.xk import XK


@pytest.fixture
def xk() -> XK:
    crawler = XK()
    yield crawler
    crawler.close()


# Real default.html shape: hrefs carry a space and a backslash before index.html.
_LANDING = r"""
<html><body>
  <a href="AIRAC AMDT 07-2026_2026_07_09\index.html">09 Jul 2026</a>
  <a href="AIRAC AMDT 08-2026_2026_08_06\index.html">06 Aug 2026</a>
  <a href="AIRAC AMDT 06-2026_2026_06_11\index.html">11 Jun 2026</a>
  <a href="A 02-2025_2025_12_25\index.html">25 Dec 2025</a>
</body></html>
"""


def test_module_root_is_kans_ks():
    assert xk_module.ROOT_URL.startswith("https://kans-ks.org")


def test_resolve_menu_picks_effective_edition_and_encodes(xk: XK):
    # On 2026-07-20 the 09 JUL edition is effective (06 AUG is future).
    menu = xk._resolve_menu_url(_LANDING, today=datetime.date(2026, 7, 20))
    assert (
        menu
        == "https://kans-ks.org/eAIP/AIRAC%20AMDT%2007-2026_2026_07_09/eAIP/menu.html"
    )
    # Space encoded (%20), backslash normalised to a path separator, no raw "\\".
    assert "%20" in menu
    assert "\\" not in menu
    assert xk.airac == "2026-07-09"


def test_resolve_menu_rolls_to_next_edition(xk: XK):
    menu = xk._resolve_menu_url(_LANDING, today=datetime.date(2026, 8, 10))
    assert "08-2026_2026_08_06" in menu
    assert xk.airac == "2026-08-06"


def test_resolve_menu_before_any_edition_takes_earliest(xk: XK):
    # Before every listed edition -> earliest (25 Dec 2025) is used.
    menu = xk._resolve_menu_url(_LANDING, today=datetime.date(2025, 1, 1))
    assert "2025_12_25" in menu
    assert xk.airac == "2025-12-25"


def test_resolve_menu_no_edition_raises(xk: XK):
    with pytest.raises(ValueError):
        xk._resolve_menu_url("<html><body>no editions</body></html>")
