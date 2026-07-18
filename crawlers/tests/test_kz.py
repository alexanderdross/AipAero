"""Unit tests for the Kazakhstan (Kazaeronavigatsia) eAIP crawler.

These cover the edition-resolution logic (`_resolve_menu_url`) - picking the
effective dated `<YYYY-MM-DD>-AIRAC` edition folder from the AIS landing page and
building the eurocontrol menu URL - without any network access.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import kz as kz_module
from crawlers.kz import KZ


@pytest.fixture
def kz() -> KZ:
    crawler = KZ()
    yield crawler
    crawler.close()


_LANDING = """
<html><body>
  <a href="/AIP/eAIP/2026-07-09-AIRAC/html/index-en-GB.html">eff 09 JUL 2026</a>
  <a href="/AIP/eAIP/2026-08-06-AIRAC/html/index-en-GB.html">eff 06 AUG 2026</a>
  <a href="/AIP/eAIP/2026-09-03-AIRAC/html/index-en-GB.html">eff 03 SEP 2026</a>
  <a href="/AIP/eAIP/2026-07-09-AIRAC/2026-07-09-AIRAC.zip">zip</a>
</body></html>
"""


def test_module_root_is_ans_kz():
    assert kz_module.ROOT_URL.startswith("https://www.ans.kz")


def test_resolve_menu_picks_effective_edition(kz: KZ):
    # On 2026-07-20 the 09 JUL edition is effective (06 AUG / 03 SEP are future).
    menu = kz._resolve_menu_url(_LANDING, today=datetime.date(2026, 7, 20))
    assert (
        menu
        == "https://www.ans.kz/AIP/eAIP/2026-07-09-AIRAC/html/eAIP/UA-menu-en-GB.html"
    )
    assert kz.airac == "2026-07-09"


def test_resolve_menu_rolls_to_next_edition(kz: KZ):
    # On 2026-08-10 the 06 AUG edition is the latest in effect.
    menu = kz._resolve_menu_url(_LANDING, today=datetime.date(2026, 8, 10))
    assert "2026-08-06-AIRAC" in menu
    assert kz.airac == "2026-08-06"


def test_resolve_menu_before_any_edition_takes_earliest(kz: KZ):
    # Before every listed edition -> earliest is used (fail-safe).
    menu = kz._resolve_menu_url(_LANDING, today=datetime.date(2026, 1, 1))
    assert "2026-07-09-AIRAC" in menu


def test_resolve_menu_no_edition_raises(kz: KZ):
    with pytest.raises(ValueError):
        kz._resolve_menu_url("<html><body>no editions</body></html>")
