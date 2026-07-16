"""Unit tests for the Moldova info-page crawler.

Moldova is not a chart crawl: the aerodrome list comes from OurAirports and
every field points at the MOLDATSA AIM portal (registration-gated). Feeds a
small CSV through a mocked client and checks the filtering - no network.
"""

from __future__ import annotations

import pytest

from crawlers import md as md_module
from crawlers.md import MD


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","LUKK","large_airport","Chisinau International","MD","LUKK"
"2","LUBL","medium_airport","Balti International","MD","LUBL"
"3","LUXX","heliport","Some Helipad","MD","LUXX"
"4","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def md(monkeypatch) -> MD:
    crawler = MD()

    def _fake_get(url, timeout=60):
        assert url == md_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert md_module.MOLDATSA_AIM_URL.startswith("https://aim.moldatsa.md")
    assert md_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_moldovan_aerodromes(md: MD):
    airports = md.crawl()
    icaos = {a.icao for a in airports}
    # LUKK + LUBL aerodromes. Heliport (LUXX) and AT (LOWW) excluded.
    assert icaos == {"LUKK", "LUBL"}
    for a in airports:
        assert a.title.endswith(a.icao)
        assert a.url == md_module.MOLDATSA_AIM_URL
        assert a.pdf_url is None
        assert a.airport_type == "vfr"
