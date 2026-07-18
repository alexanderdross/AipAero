"""Unit tests for the Italy info-page crawler.

Italy is not a chart crawl: the aerodrome list comes from OurAirports and every
field points at the ENAV Self Briefing portal (charts are login-gated). These
tests feed a small CSV through a mocked client and check the filtering (Italian
aerodromes with a real ICAO only, no charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import it as it_module
from crawlers.it import IT


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","LIRF","large_airport","Roma Fiumicino","IT","LIRF"
"2","LIMC","medium_airport","Milano Malpensa","IT","LIMC"
"3","LIRU","small_airport","Roma Urbe","IT",""
"4","LIXX","heliport","Some Hospital Helipad","IT","LIXX"
"5","LI99","small_airport","Closed strip","IT","LI99"
"6","XXCLOSED","closed","Old field","IT","LIZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def it(monkeypatch) -> IT:
    crawler = IT()

    def _fake_get(url, timeout=60):
        assert url == it_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert it_module.ENAV_AIP_URL.startswith("https://www.enav.it")
    assert it_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_italian_aerodromes(it: IT):
    airports = it.crawl()
    icaos = {a.icao for a in airports}
    # LIRF (icao_code), LIMC, LIRU (ident, no icao_code) are Italian aerodromes.
    assert icaos == {"LIRF", "LIMC", "LIRU"}
    assert "LIXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "LI99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_enav_no_charts(it: IT):
    airports = it.crawl()
    for a in airports:
        assert a.country == "IT"
        assert a.airport_type == "vfr"
        assert a.url == it_module.ENAV_AIP_URL
        assert a.pdf_url is None
        assert a.charts is None
    # Title convention is "<name> <ICAO>" (map label / list / detail heading).
    roma = next(a for a in airports if a.icao == "LIRF")
    assert roma.title == "Roma Fiumicino LIRF"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
