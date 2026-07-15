"""Unit tests for the Switzerland info-page crawler.

Switzerland is not a chart crawl: the aerodrome list comes from OurAirports
and every field points at the skybriefing AIP portal (charts are paywalled).
These tests feed a small CSV through a mocked client and check the filtering
(Swiss aerodromes with a real ICAO only, no charts) - no network.
"""

from __future__ import annotations

import pytest

from crawlers import ch as ch_module
from crawlers.ch import CH


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","LSZH","large_airport","Zurich Airport","CH","LSZH"
"2","LSGG","medium_airport","Geneva Airport","CH","LSGG"
"3","LSZR","small_airport","St. Gallen Altenrhein","CH",""
"4","LSXX","heliport","Some Hospital Helipad","CH","LSXX"
"5","LS99","small_airport","Closed strip","CH","LS99"
"6","XXCLOSED","closed","Old field","CH","LSZZ"
"7","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def ch(monkeypatch) -> CH:
    crawler = CH()

    def _fake_get(url, timeout=60):
        assert url == ch_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert ch_module.SKYBRIEFING_AIP_URL.startswith("https://www.skybriefing.com")
    assert ch_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_swiss_aerodromes(ch: CH):
    airports = ch.crawl()
    icaos = {a.icao for a in airports}
    # LSZH (icao_code), LSGG, LSZR (ident, no icao_code) are Swiss aerodromes.
    assert icaos == {"LSZH", "LSGG", "LSZR"}
    # Heliport (LSXX), closed field (AT LOWW), non-alpha ident (LS99) excluded.
    assert "LSXX" not in icaos  # heliport type
    assert "LOWW" not in icaos  # wrong country
    assert "LS99" not in icaos  # not a 4-letter code


def test_crawl_rows_point_at_skybriefing_no_charts(ch: CH):
    airports = ch.crawl()
    for a in airports:
        assert a.country == "CH"
        assert a.airport_type == "vfr"
        assert a.url == ch_module.SKYBRIEFING_AIP_URL
        assert a.pdf_url is None
        assert a.charts is None
    zurich = next(a for a in airports if a.icao == "LSZH")
    assert zurich.title == "Zurich Airport"
