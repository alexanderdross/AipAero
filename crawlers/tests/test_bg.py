"""Unit tests for the Bulgaria crawler (BULATSA b-flip chart crawl).

The live Aerodromes page is an Angular SPA rendered with headless Chromium; the
parsing that turns its `#aip_content` table into Airports is pure, so these
tests exercise it against a captured fragment (no network / browser). They lock
in the two things that drive the site: the "<name> <ICAO>" title rule + map
labels, and grouping the `/_aip/AD_files/LB_AD_*` chart PDFs by the ICAO in
their own filename (robust against the table's stray cross-links).
"""

from __future__ import annotations

import pytest

from crawlers import bg as bg_module
from crawlers.bg import BG

# A trimmed but structurally faithful capture of the rendered AD table: an AD 2
# aerodrome (full chart set), an AD 4 small field (data sheet + VAC), an AD 5
# heliport (data sheet only), a STRAY cross-link to LBPD inside the LBBG block
# (must group under LBPD, not LBBG), and an AIC circular under /cd/ (ignored).
_TABLE = """
<div id="aip_content" class="aip_ad"><table class="content"><tbody>
<tr class="tr_head"><td><br></td><td><br></td><td><big>AD 2</big></td>
  <td><big>AERODROMES</big></td><td><br></td></tr>
<tr class="tr_head"><td><br></td><td><br></td><td><big>LBBG</big></td>
  <td><big>БУРГАС / BURGAS</big></td><td><br></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_2_LBBG_en.pdf">Burgas - Textual data</a></td><td></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_2_LBBG_41_1_2_en.pdf">Aerodrome Chart - ICAO (BURGAS)</a></td><td></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_2_LBBG_59_1_2_3_4_en.pdf">Visual Approach Chart - ICAO (BURGAS)</a></td><td></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_2_LBPD_61_1_2_en.pdf">Waypoint list (stray cross-link)</a></td><td></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/../cd/CD-ROM_01_2016/AIC_files/2016/LB_Circ_2016_01_en.pdf">circular</a></td><td></td></tr>
<tr class="tr_head"><td><br></td><td><br></td><td><big><span>LBPD</span></big></td>
  <td><big>ПЛОВДИВ / PLOVDIV</big></td><td><br></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_2_LBPD_en.pdf">Plovdiv - Textual data</a></td><td></td></tr>
<tr class="tr_head"><td><br></td><td><br></td><td><big>AD 4</big></td>
  <td><big>AERODROMES &lt; 5700 KG</big></td><td><br></td></tr>
<tr class="tr_head"><td><br></td><td><br></td><td><big>LBBM</big></td>
  <td><big>БЕЛОЗЕМ / BELOZEM</big></td><td><br></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_4_LBBM_en.pdf">Belozem - Textual data</a></td><td></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_4_LBBM_59_1_en.pdf">Visual Approach Chart - ICAO (BELOZEM)</a></td><td></td></tr>
<tr class="tr_head"><td><br></td><td><br></td><td><big>AD 5</big></td>
  <td><big>HELIPORTS</big></td><td><br></td></tr>
<tr class="tr_head"><td><br></td><td><br></td><td><big>LBSL</big></td>
  <td><big>СЛИВЕН / SLIVEN</big></td><td><br></td></tr>
<tr><td></td><td></td><td></td>
  <td><a href="_aip/AD_files/LB_AD_5_LBSL_en.pdf">Sliven Heliport - Textual data</a></td><td></td></tr>
</tbody></table></div>
"""


@pytest.fixture
def bg() -> BG:
    crawler = BG()
    yield crawler
    crawler.close()


def test_module_constants():
    assert bg_module.ROOT_URL == "https://b-flip.bulatsa.com/"
    assert bg_module.AD_PAGE_URL.endswith("/publications/aip/aerodromes")


def test_latin_name_keeps_english_half_and_title_cases(bg: BG):
    assert bg._latin_name("БУРГАС / BURGAS") == "Burgas"
    assert (
        bg._latin_name("ВАСИЛ ЛЕВСКИ - СОФИЯ / VASIL LEVSKI - SOFIA")
        == "Vasil Levski - Sofia"
    )


def test_parse_groups_by_filename_icao(bg: BG):
    airports = bg._parse_ad_table(_TABLE)
    icaos = [a.icao for a in airports]
    # The stray LBPD_61 link inside the LBBG block is grouped under LBPD, so
    # exactly four fields surface (LBBG, LBPD, LBBM, LBSL) - no cross-contamination.
    assert set(icaos) == {"LBBG", "LBPD", "LBBM", "LBSL"}
    # The AIC circular under /cd/ is not an AD_files PDF and must be dropped.
    for a in airports:
        for c in a.charts or []:
            assert "AD_files" in c.url and "LB_Circ" not in c.url


def test_primary_chart_prefers_vac_then_data(bg: BG):
    by = {a.icao: a for a in bg._parse_ad_table(_TABLE)}
    # LBBG has a VAC (section 59) - it wins over the ADC (41) and data sheet.
    assert by["LBBG"].url.endswith("LB_AD_2_LBBG_59_1_2_3_4_en.pdf")
    assert by["LBBG"].pdf_url == by["LBBG"].url
    assert len(by["LBBG"].charts) == 3
    # LBPD only carries a waypoint + data sheet (no VAC/ADC): data sheet primary.
    assert by["LBPD"].url.endswith("LB_AD_2_LBPD_en.pdf")


def test_type_and_title_rules(bg: BG):
    by = {a.icao: a for a in bg._parse_ad_table(_TABLE)}
    # AD 5 field is a heliport; AD 2 / AD 4 fields are vfr.
    assert by["LBSL"].airport_type == "heliport"
    assert by["LBBG"].airport_type == "vfr"
    assert by["LBBM"].airport_type == "vfr"
    # Hard "<name> <ICAO>" title rule (list row + map marker label).
    assert by["LBBG"].title == "Burgas LBBG"
    assert by["LBSL"].title == "Sliven LBSL"
    for a in by.values():
        assert a.country == "BG"
        assert a.icao and a.title.endswith(a.icao)
        assert a.title.strip().upper() != a.icao
        assert a.url.startswith("https://b-flip.bulatsa.com/_aip/AD_files/")


def test_urls_resolve_against_site_root_not_page(bg: BG):
    # Relative hrefs are "_aip/AD_files/..."; they must resolve against the site
    # ROOT (/_aip/...), not the /publications/aip/ page path.
    airports = bg._parse_ad_table(_TABLE)
    for a in airports:
        assert "/publications/aip/_aip/" not in a.url
        assert a.url.startswith("https://b-flip.bulatsa.com/_aip/AD_files/")
