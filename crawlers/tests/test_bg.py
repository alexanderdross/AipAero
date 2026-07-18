"""Unit tests for the Bulgaria info-page crawler.

Bulgaria is not a chart crawl: the aerodrome list comes from OurAirports and
every field points at the BULATSA b-flip AIP portal (charts are registration-
gated). These tests feed a small CSV through a mocked client and check the
filtering (Bulgarian aerodromes with a real ICAO only, no charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import bg as bg_module
from crawlers.bg import BG


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","LBSF","large_airport","Sofia Airport","BG","LBSF"
"2","LBBG","medium_airport","Burgas Airport","BG","LBBG"
"3","LBPL","small_airport","Plovdiv Krumovo","BG",""
"4","LBXX","heliport","Some Hospital Helipad","BG","LBXX"
"5","LB99","small_airport","Closed strip","BG","LB99"
"6","XXCLOSED","closed","Old field","BG","LBZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def bg(monkeypatch) -> BG:
    crawler = BG()

    def _fake_get(url, timeout=60):
        assert url == bg_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert bg_module.BULATSA_AIP_URL.startswith("https://b-flip.bulatsa.com")
    assert bg_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_bulgarian_aerodromes(bg: BG):
    airports = bg.crawl()
    icaos = {a.icao for a in airports}
    # LBSF (icao_code), LBBG, LBPL (ident, no icao_code) are Bulgarian aerodromes.
    assert icaos == {"LBSF", "LBBG", "LBPL"}
    assert "LBXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "LB99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_bulatsa_no_charts(bg: BG):
    airports = bg.crawl()
    for a in airports:
        assert a.country == "BG"
        assert a.airport_type == "vfr"
        assert a.url == bg_module.BULATSA_AIP_URL
        assert a.pdf_url is None
        assert a.charts is None
    # Title convention is "<name> <ICAO>" (map label / list / detail heading).
    sofia = next(a for a in airports if a.icao == "LBSF")
    assert sofia.title == "Sofia Airport LBSF"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
