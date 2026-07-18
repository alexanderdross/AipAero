"""Unit tests for the Belarus info-page crawler.

Belarus is not a chart crawl: the aerodrome list comes from OurAirports and every
field points at the Belaeronavigatsia AIP portal (the eAIP is registration-gated).
These tests feed a small CSV through a mocked client and check the filtering
(Belarusian aerodromes with a real ICAO only, no charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import by as by_module
from crawlers.by import BY


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","UMMS","large_airport","Minsk National","BY","UMMS"
"2","UMGG","medium_airport","Gomel","BY","UMGG"
"3","UMBB","small_airport","Brest","BY",""
"4","UMXX","heliport","Some Helipad","BY","UMXX"
"5","UM99","small_airport","Closed strip","BY","UM99"
"6","XXCLOSED","closed","Old field","BY","UMZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def by(monkeypatch) -> BY:
    crawler = BY()

    def _fake_get(url, timeout=60):
        assert url == by_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert by_module.AIP_URL.startswith("https://www.ban.by")
    assert by_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_belarusian_aerodromes(by: BY):
    airports = by.crawl()
    icaos = {a.icao for a in airports}
    assert icaos == {"UMMS", "UMGG", "UMBB"}
    assert "UMXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "UM99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_portal_no_charts(by: BY):
    airports = by.crawl()
    for a in airports:
        assert a.country == "BY"
        assert a.airport_type == "vfr"
        assert a.url == by_module.AIP_URL
        assert a.pdf_url is None
        assert a.charts is None
    minsk = next(a for a in airports if a.icao == "UMMS")
    assert minsk.title == "Minsk National UMMS"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
