"""Unit tests for the Malta info-page crawler.

Malta is not a chart crawl: the aerodrome list comes from OurAirports and every
field points at the Transport Malta AIP page (the MATS AIP portal is a JS app).
Feeds a small CSV through a mocked client and checks the filtering - no network.
"""

from __future__ import annotations

import pytest

from crawlers import mt as mt_module
from crawlers.mt import MT


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


_CSV = """\
"id","ident","type","name","iso_country","icao_code"
"1","LMML","large_airport","Malta International Airport","MT","LMML"
"2","LMMG","heliport","Gozo Heliport","MT","LMMG"
"3","LM99","small_airport","Non alpha ident","MT","LM99"
"4","LOWW","large_airport","Vienna","AT","LOWW"
"""


@pytest.fixture
def mt(monkeypatch) -> MT:
    crawler = MT()

    def _fake_get(url, timeout=60):
        assert url == mt_module.AIRPORTS_CSV
        return _FakeResp(_CSV)

    monkeypatch.setattr(crawler.client, "get", _fake_get)
    yield crawler
    crawler.close()


def test_module_constants():
    assert mt_module.MALTA_AIP_URL.startswith("https://www.transport.gov.mt")
    assert mt_module.AIRPORTS_CSV.endswith("airports.csv")


def test_crawl_filters_to_maltese_aerodromes(mt: MT):
    airports = mt.crawl()
    icaos = {a.icao for a in airports}
    # Only LMML (aerodrome with real ICAO). Heliport, non-alpha ident, AT excluded.
    assert icaos == {"LMML"}
    lmml = airports[0]
    assert lmml.title == "Malta International Airport LMML"
    assert lmml.title.endswith(lmml.icao)
    assert lmml.url == mt_module.MALTA_AIP_URL
    assert lmml.pdf_url is None
    assert lmml.airport_type == "vfr"
