"""Unit tests for the Croatia info-page crawler.

Croatia is not a chart crawl: the aerodrome list comes from OurAirports and
every field points at the Croatia Control AIM Portal (charts moved behind the
subscription on 01.01.2026). These tests feed a small CSV through a mocked
client and check the filtering (Croatian aerodromes with a real ICAO only, no
charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import hr as hr_module
from crawlers.hr import HR


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","LDZA","large_airport","Zagreb Franjo Tudman","HR","LDZA"
"2","LDSP","medium_airport","Split Airport","HR","LDSP"
"3","LDVA","small_airport","Varazdin","HR",""
"4","LDXX","heliport","Some Hospital Helipad","HR","LDXX"
"5","LD99","small_airport","Closed strip","HR","LD99"
"6","XXCLOSED","closed","Old field","HR","LDZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def hr(monkeypatch) -> HR:
    crawler = HR()

    def _fake_get(url, timeout=60):
        assert url == hr_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert hr_module.CROCONTROL_AIP_URL.startswith("https://aim.crocontrol.hr")
    assert hr_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_croatian_aerodromes(hr: HR):
    airports = hr.crawl()
    icaos = {a.icao for a in airports}
    # LDZA (icao_code), LDSP, LDVA (ident, no icao_code) are Croatian aerodromes.
    assert icaos == {"LDZA", "LDSP", "LDVA"}
    assert "LDXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "LD99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_crocontrol_no_charts(hr: HR):
    airports = hr.crawl()
    for a in airports:
        assert a.country == "HR"
        assert a.airport_type == "vfr"
        assert a.url == hr_module.CROCONTROL_AIP_URL
        assert a.pdf_url is None
        assert a.charts is None
    # Title convention is "<name> <ICAO>" (map label / list / detail heading).
    zagreb = next(a for a in airports if a.icao == "LDZA")
    assert zagreb.title == "Zagreb Franjo Tudman LDZA"
    for a in airports:
        assert a.icao and a.title.endswith(a.icao)
