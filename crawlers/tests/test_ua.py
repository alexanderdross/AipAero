"""Unit tests for the Ukraine info-page crawler.

Ukraine is not a chart crawl: the aerodrome list comes from OurAirports and every
field points at the UkSATSE AIS portal (the eAIP is subscription-gated). These
tests feed a small CSV through a mocked client and check the filtering (Ukrainian
aerodromes with a real ICAO only, no charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import ua as ua_module
from crawlers.ua import UA


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","UKBB","large_airport","Kyiv Boryspil","UA","UKBB"
"2","UKLL","medium_airport","Lviv","UA","UKLL"
"3","UKKK","small_airport","Kyiv Zhuliany","UA",""
"4","UKXX","heliport","Some Helipad","UA","UKXX"
"5","UK99","small_airport","Closed strip","UA","UK99"
"6","XXCLOSED","closed","Old field","UA","UKZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def ua(monkeypatch) -> UA:
    crawler = UA()

    def _fake_get(url, timeout=60):
        assert url == ua_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert ua_module.AIS_URL.startswith("https://www.aisukraine.net")
    assert ua_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_ukrainian_aerodromes(ua: UA):
    airports = ua.crawl()
    icaos = {a.icao for a in airports}
    assert icaos == {"UKBB", "UKLL", "UKKK"}
    assert "UKXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "UK99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_ais_no_charts(ua: UA):
    airports = ua.crawl()
    for a in airports:
        assert a.country == "UA"
        assert a.airport_type == "vfr"
        assert a.url == ua_module.AIS_URL
        assert a.pdf_url is None
        assert a.charts is None
    kyiv = next(a for a in airports if a.icao == "UKBB")
    assert kyiv.title == "Kyiv Boryspil UKBB"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
