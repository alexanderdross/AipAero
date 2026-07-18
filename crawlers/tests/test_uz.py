"""Unit tests for the Uzbekistan info-page crawler.

Uzbekistan is not a chart crawl: the aerodrome list comes from OurAirports and
every field points at the Uzaeronavigation AIP portal (the AIS index is gated).
These tests feed a small CSV through a mocked client and check the filtering
(Uzbek aerodromes with a real ICAO only, no charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import uz as uz_module
from crawlers.uz import UZ


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


# Uzbekistan migrated to the UZ** ICAO block in Oct 2025; OurAirports may carry
# either, so the crawler stays code-agnostic (any 4-letter ICAO for iso UZ).
_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","UZTT","large_airport","Tashkent","UZ","UZTT"
"2","UZSS","medium_airport","Samarkand","UZ","UZSS"
"3","UZBB","small_airport","Bukhara","UZ",""
"4","UZXX","heliport","Some Helipad","UZ","UZXX"
"5","UZ99","small_airport","Closed strip","UZ","UZ99"
"6","XXCLOSED","closed","Old field","UZ","UZZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def uz(monkeypatch) -> UZ:
    crawler = UZ()

    def _fake_get(url, timeout=60):
        assert url == uz_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert uz_module.AIS_URL.startswith("https://uzaeronavigation.com")
    assert uz_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_uzbek_aerodromes(uz: UZ):
    airports = uz.crawl()
    icaos = {a.icao for a in airports}
    assert icaos == {"UZTT", "UZSS", "UZBB"}
    assert "UZXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "UZ99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_ais_no_charts(uz: UZ):
    airports = uz.crawl()
    for a in airports:
        assert a.country == "UZ"
        assert a.airport_type == "vfr"
        assert a.url == uz_module.AIS_URL
        assert a.pdf_url is None
        assert a.charts is None
    tashkent = next(a for a in airports if a.icao == "UZTT")
    assert tashkent.title == "Tashkent UZTT"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
