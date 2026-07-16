"""Unit tests for the Cyprus crawler (DCA "Open Cyprus VFR Manual").

Covers the menu parse: which chart links become aerodrome fields (Larnaka
LCLK, Pafos LCPH) and which are skipped (the country-wide LCCC sheet, non-chart
links), the "<name> <ICAO>" title, and the record-of-updates date parse. No
network - the live fetch is exercised by the live test.
"""

from __future__ import annotations

import pytest

from crawlers import cy as cy_module
from crawlers.cy import CY


@pytest.fixture
def cy() -> CY:
    crawler = CY()
    yield crawler
    crawler.close()


# Mirrors the real menu.html: the two aerodrome charts, the country-wide LCCC
# sheet (must be skipped), plus a section HTML link (not a chart).
_MENU = """
<a href="./html/PART_1_GENERAL.html#gen">1.1 AIR TRAFFIC CONTROL SERVICE</a>
<a href="./html/LANDING_STRIPS_HELIPADS.html">LANDING STRIPS / HELIPADS</a>
<a href="./charts/VFR_CHART_LCLK.pdf">Local VFR Chart Larnaka</a>
<a href="./charts/VFR_CHART_LCPH.pdf">Local VFR Chart Pafos</a>
<a href="./charts/VFR_CHART_LCCC.pdf">Local VFR CYPRUS</a>
"""


def test_module_root_is_dca_cyprus():
    assert cy_module.ROOT_URL == "http://vfrmanual.dca.mcw.gov.cy/"


def test_extract_reads_two_aerodromes(cy: CY):
    airports = cy._extract_from(_MENU, cy_module.MENU_URL)
    # Larnaka + Pafos; the country-wide LCCC chart is excluded by its label.
    assert {a.icao for a in airports} == {"LCLK", "LCPH"}
    assert all(a.airport_type == "vfr" and a.country == "CY" for a in airports)
    larnaka = next(a for a in airports if a.icao == "LCLK")
    assert larnaka.title == "Larnaka LCLK"
    assert larnaka.url.endswith("/charts/VFR_CHART_LCLK.pdf")
    assert larnaka.pdf_url == larnaka.url
    assert larnaka.charts and larnaka.charts[0].url == larnaka.url


def test_extract_skips_country_chart_and_non_charts(cy: CY):
    airports = cy._extract_from(_MENU, cy_module.MENU_URL)
    # LCCC (Nicosia FIR / country-wide) and the HTML section links are not fields.
    assert "LCCC" not in {a.icao for a in airports}
    assert all(a.url.endswith(".pdf") for a in airports)


def test_titles_end_with_icao(cy: CY):
    for a in cy._extract_from(_MENU, cy_module.MENU_URL):
        assert a.icao is not None
        assert a.title.endswith(a.icao)


def test_airac_from_updates_takes_newest_date(cy: CY):
    html = "<td>15 JAN 2016</td><td>30 APR 2019</td><td>03-FEB-2018</td>"
    assert cy._airac_from_updates(html) == "2019-04-30"
    assert cy._airac_from_updates("<td>no dates here</td>") is None
