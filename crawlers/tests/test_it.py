"""Unit tests for the Italy crawler (ENAV open eurocontrol eAIP).

Covers the edition-by-date resolution off the `default.html` issues index and
the deterministic menu-frame URL construction (no network - the live fetch +
AD-2 parse are exercised by the live test). ENAV names each edition folder
`(A<NN>-<YY>)_<YYYY>_<MM>_<DD>` with the parens raw or %28/%29-encoded, so both
forms are covered.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import it as it_module
from crawlers.it import IT

# The issues index names several editions; the crawler must pick the latest one
# on/before "today". Includes a %28/%29-encoded folder (April) to prove both
# paren encodings parse, and a future edition (August) that must be ignored.
_LANDING = """
<html><body>
<a href="(A05-26)_2026_05_15/index.html">15 MAY 2026</a>
<a href="(A07-26)_2026_07_09/index.html">09 JUL 2026 - Currently Effective</a>
<a href="(A08-26)_2026_08_06/index.html">06 AUG 2026 - Forthcoming</a>
<a href="%28A04-26%29_2026_04_17/index.html">17 APR 2026</a>
</body></html>
"""


@pytest.fixture
def it() -> IT:
    crawler = IT()
    yield crawler
    crawler.close()


def test_module_constants():
    assert it_module.ROOT_URL.endswith("/AIP/AIP/default.html")
    assert it_module._MENU_SUFFIX == "eAIP/LI-menu-en-GB.html"


def test_resolve_menu_picks_effective_edition(it: IT):
    menu = it._resolve_menu_url(_LANDING, today=datetime.date(2026, 7, 15))
    # 09 JUL 2026 is the latest edition on/before 15 JUL (06 AUG is future).
    assert menu == (
        "https://onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/"
        "(A07-26)_2026_07_09/eAIP/LI-menu-en-GB.html"
    )
    # The effective edition date is forwarded to crawl_meta.airac.
    assert it.airac == "2026-07-09"


def test_resolve_menu_parses_encoded_parens(it: IT):
    # Only the encoded April edition is on/before this date - it must resolve
    # (proves the %28/%29 form is matched too).
    menu = it._resolve_menu_url(_LANDING, today=datetime.date(2026, 4, 20))
    assert "%28A04-26%29_2026_04_17/eAIP/LI-menu-en-GB.html" in menu
    assert it.airac == "2026-04-17"


def test_resolve_menu_no_editions_raises(it: IT):
    with pytest.raises(ValueError, match="no eAIP edition folder"):
        it._resolve_menu_url("<html><body>nothing here</body></html>")
