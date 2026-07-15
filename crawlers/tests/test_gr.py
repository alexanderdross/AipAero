"""Unit tests for the Greece crawler (HASP static per-edition AIP tree).

Two groups: (1) the Bright Data zone-selection preference in __init__ (Web
Unlocker over plain proxy - the deep static edition paths still need a proxy);
(2) edition-folder resolution by effective date and the AIP-menu.htm link
harvest (AD 2 aerodrome VFR + text sheets, AD 3 heliports by place name, GEN
front matter ignored). The live source is proxied, so these run against mocked
HTML - the real fetch path is exercised by the live test.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import gr as gr_module
from crawlers.gr import GR


# --- zone selection (no network) -------------------------------------------


@pytest.fixture
def _capture_use_proxy(monkeypatch):
    """Record every use_proxy(url) call instead of opening a real client."""
    calls: list[str] = []
    monkeypatch.setattr(GR, "use_proxy", lambda self, url: calls.append(url))
    monkeypatch.setattr(GR, "use_browser_headers", lambda self: None)
    return calls


def test_prefers_unlocker_over_proxy(monkeypatch, _capture_use_proxy):
    monkeypatch.setenv("BRIGHTDATA_UNLOCKER_URL", "http://u:p@unlocker.test:1")
    monkeypatch.setenv("BRIGHTDATA_PROXY_URL", "http://u:p@proxy.test:2")
    gr = GR()
    assert _capture_use_proxy == ["http://u:p@unlocker.test:1"]
    gr.close()


def test_falls_back_to_plain_proxy(monkeypatch, _capture_use_proxy):
    monkeypatch.delenv("BRIGHTDATA_UNLOCKER_URL", raising=False)
    monkeypatch.setenv("BRIGHTDATA_PROXY_URL", "http://u:p@proxy.test:2")
    gr = GR()
    assert _capture_use_proxy == ["http://u:p@proxy.test:2"]
    gr.close()


def test_no_zone_configured_does_not_route(monkeypatch, _capture_use_proxy):
    monkeypatch.delenv("BRIGHTDATA_UNLOCKER_URL", raising=False)
    monkeypatch.delenv("BRIGHTDATA_PROXY_URL", raising=False)
    gr = GR()
    assert _capture_use_proxy == []
    gr.close()


def test_module_root_url_is_hasp():
    assert gr_module.HOST == "https://aisgr.hasp.gov.gr/"
    assert gr_module.ROOT_URL.startswith("https://aisgr.hasp.gov.gr/")


# --- edition resolution + menu parsing (no network) ------------------------


@pytest.fixture
def gr(monkeypatch) -> GR:
    monkeypatch.delenv("BRIGHTDATA_UNLOCKER_URL", raising=False)
    monkeypatch.delenv("BRIGHTDATA_PROXY_URL", raising=False)
    crawler = GR()
    yield crawler
    crawler.close()


_LANDING = """
<a href="aipgr_incl_amdt_0626_wef_09jul2026/cd/ais/indexaip.htm">Current</a>
<a href="aipgr_incl_amdt_0726_wef_06aug2026/cd/ais/index.html">Next</a>
"""

_MENU = """
<a href="eaip/pdf/AD%202/AD2-LGAD/LG_AD_2_LGAD_en.pdf">AD 2 LGAD</a>
<a href="eaip/pdf/AD%202/AD2-LGAD/LG_AD_2_LGAD_VFR_en.pdf">AD 2-LGAD-VFR</a>
<a href="eaip/pdf/AD%202/AD2-LGAV/LG_AD_2_LGAV_VFR_en.pdf">AD 2-LGAV-VFR</a>
<a href="eaip/pdf/AD%203/AD3-ALONISSOS/LG_AD_3_ALONISSOS_VFR_en.pdf">AD 3.5 ALONISSOS</a>
<a href="eaip/pdf/gen%200/LG_GEN_0_1_en.pdf">GEN 0.1 PREFACE</a>
"""


def test_resolve_edition_picks_effective(gr: GR):
    base = gr._resolve_edition_base(_LANDING, today=datetime.date(2026, 7, 15))
    assert base == (
        "https://aisgr.hasp.gov.gr/"
        "aipgr_incl_amdt_0626_wef_09jul2026/cd/ais/"
    )
    assert gr.airac == "2026-07-09"


def test_resolve_edition_no_token_raises(gr: GR):
    with pytest.raises(ValueError):
        gr._resolve_edition_base("<html>nothing</html>")


def test_airac_dates_follow_28day_cycle(gr: GR):
    # Newest-first AIRAC effective dates on/before 15 JUL 2026.
    ds = GR.airac_dates_on_or_before(datetime.date(2026, 7, 15), 3)
    assert ds == [
        datetime.date(2026, 7, 9),
        datetime.date(2026, 6, 11),
        datetime.date(2026, 5, 14),
    ]


def test_edition_token_matches_real_folders(gr: GR):
    assert (
        GR._edition_token(6, datetime.date(2026, 7, 9))
        == "aipgr_incl_amdt_0626_wef_09jul2026"
    )
    assert (
        GR._edition_token(7, datetime.date(2026, 8, 6))
        == "aipgr_incl_amdt_0726_wef_06aug2026"
    )


def test_parse_menu_ad2_and_ad3(gr: GR):
    base = "https://aisgr.hasp.gov.gr/aipgr_incl_amdt_0626_wef_09jul2026/cd/ais/"
    aps = gr._parse_menu(_MENU, base)
    by_key = {(a.airport_type, a.icao or a.title): a for a in aps}

    lgad = by_key[("vfr", "LGAD")]
    assert lgad.pdf_url.endswith("/LG_AD_2_LGAD_VFR_en.pdf")
    assert lgad.url == lgad.pdf_url
    assert {c.name for c in lgad.charts} == {"LGAD VFR", "AD 2 LGAD"}

    lgav = by_key[("vfr", "LGAV")]
    assert len(lgav.charts) == 1

    alonissos = by_key[("heliport", "ALONISSOS")]
    assert alonissos.icao is None
    assert alonissos.title == "ALONISSOS"
    assert alonissos.pdf_url.endswith("/LG_AD_3_ALONISSOS_VFR_en.pdf")

    assert not any("GEN" in (a.title or "") for a in aps)
