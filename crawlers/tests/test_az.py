"""Unit tests for the Azerbaijan info-page crawler.

Azerbaijan is not a chart crawl: the aerodrome list comes from OurAirports and
every field points at the State Civil Aviation Agency (no open eAIP). These tests
feed a small CSV through a mocked client and check the filtering (Azerbaijani
aerodromes with a real ICAO only, no charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import az as az_module
from crawlers.az import AZ


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","UBBB","large_airport","Baku Heydar Aliyev","AZ","UBBB"
"2","UBBG","medium_airport","Ganja","AZ","UBBG"
"3","UBBN","small_airport","Nakhchivan","AZ",""
"4","UBXX","heliport","Some Helipad","AZ","UBXX"
"5","UB99","small_airport","Closed strip","AZ","UB99"
"6","XXCLOSED","closed","Old field","AZ","UBZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def az(monkeypatch) -> AZ:
    crawler = AZ()

    def _fake_get(url, timeout=60):
        assert url == az_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert az_module.CAA_AIP_URL.startswith("https://www.caa.gov.az")
    assert az_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_azerbaijani_aerodromes(az: AZ):
    airports = az.crawl()
    icaos = {a.icao for a in airports}
    assert icaos == {"UBBB", "UBBG", "UBBN"}
    assert "UBXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "UB99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_caa_no_charts(az: AZ):
    airports = az.crawl()
    for a in airports:
        assert a.country == "AZ"
        assert a.airport_type == "vfr"
        assert a.url == az_module.CAA_AIP_URL
        assert a.pdf_url is None
        assert a.charts is None
    baku = next(a for a in airports if a.icao == "UBBB")
    assert baku.title == "Baku Heydar Aliyev UBBB"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
