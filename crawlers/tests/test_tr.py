"""Unit tests for the Turkey info-page crawler.

Turkey is not a chart crawl: the aerodrome list comes from OurAirports and
every field points at the DHMI AIP Turkiye portal (charts are behind a paid
subscription). These tests feed a small CSV through a mocked client and check
the filtering (Turkish aerodromes with a real ICAO only, no charts) - no
network.
"""

from __future__ import annotations

import pytest

from crawlers import tr as tr_module
from crawlers.tr import TR


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","LTFM","large_airport","Istanbul Airport","TR","LTFM"
"2","LTAC","medium_airport","Ankara Esenboga","TR","LTAC"
"3","LTBU","small_airport","Corlu","TR",""
"4","LTXX","heliport","Some Hospital Helipad","TR","LTXX"
"5","LT99","small_airport","Closed strip","TR","LT99"
"6","XXCLOSED","closed","Old field","TR","LTZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def tr(monkeypatch) -> TR:
    crawler = TR()

    def _fake_get(url, timeout=60):
        assert url == tr_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert tr_module.DHMI_AIP_URL.startswith("https://dhmi.gov.tr")
    assert tr_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_turkish_aerodromes(tr: TR):
    airports = tr.crawl()
    icaos = {a.icao for a in airports}
    # LTFM (icao_code), LTAC, LTBU (ident, no icao_code) are Turkish aerodromes.
    assert icaos == {"LTFM", "LTAC", "LTBU"}
    assert "LTXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "LT99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_dhmi_no_charts(tr: TR):
    airports = tr.crawl()
    for a in airports:
        assert a.country == "TR"
        assert a.airport_type == "vfr"
        assert a.url == tr_module.DHMI_AIP_URL
        assert a.pdf_url is None
        assert a.charts is None
    # Title convention is "<name> <ICAO>" (map label / list / detail heading).
    istanbul = next(a for a in airports if a.icao == "LTFM")
    assert istanbul.title == "Istanbul Airport LTFM"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
