"""Unit tests for the Czechia crawler: per-chapter IFR extraction + VFR-manual
chart picking."""

from __future__ import annotations

import pytest

from crawlers.cz import CZ

NAV = """<div id="menu">
  <div><a href="ad/LKPR.html">AD 2.LKPR PRAHA/Ruzyně</a></div>
  <div id="menu-AD-2.LKPRdetails">
    <div><a href="charts/LKPR.pdf" title="Charts related to the aerodrome">c</a></div>
  </div>
  <div><a href="ad/LKTB.html">AD 2.LKTB BRNO/Tuřany</a></div>
  <div id="menu-AD-2.LKTBdetails">
    <div><a href="charts/LKTB.pdf" title="Charts related to the aerodrome">c</a></div>
  </div>
</div>"""


@pytest.fixture
def crawler() -> CZ:
    c = CZ()
    yield c
    c.close()


# ----- per-chapter IFR extraction ---------------------------------------------


def test_extracts_ifr_aerodromes_with_name_icao_titles(crawler: CZ):
    airports = crawler._extract_airport_sections(NAV, "https://aim.rlp.cz/eaip/nav.html")
    assert sorted(a.icao for a in airports) == ["LKPR", "LKTB"]
    assert {a.airport_type for a in airports} == {"ifr"}
    for a in airports:
        assert a.title.endswith(a.icao)  # "<name> <ICAO>" rule
        assert a.title != a.icao  # a real place name, not a bare code


def test_empty_nav_raises(crawler: CZ):
    with pytest.raises(ValueError):
        crawler._extract_airport_sections("<div>nothing here</div>", "u")


# ----- VFR-manual chart picking ----------------------------------------------


def test_vfr_charts_prefers_the_map_pdf_as_primary(crawler: CZ):
    html = """
    <a href="lktb_app_en.pdf">Approach</a>
    <a href="lktb_map_en.pdf">Charts</a>
    <a href="lktb_park_en.pdf">Parking</a>
    """
    charts, primary = crawler._vfr_charts(
        html, "https://aim.rlp.cz/vfrmanual/actual/lktb_text_en.html"
    )
    assert primary.endswith("lktb_map_en.pdf")  # the *_map_en.pdf wins
    assert len(charts) == 3


def test_vfr_charts_falls_back_to_first_pdf(crawler: CZ):
    html = '<a href="lktb_app_en.pdf">Approach</a><a href="lktb_park_en.pdf">P</a>'
    _, primary = crawler._vfr_charts(html, "https://aim.rlp.cz/vfrmanual/actual/x.html")
    assert primary.endswith("lktb_app_en.pdf")  # first PDF, no map available


def test_vfr_charts_none_when_no_pdfs(crawler: CZ):
    charts, primary = crawler._vfr_charts("<a href='x.html'>no pdf</a>", "u")
    assert charts == [] and primary is None
