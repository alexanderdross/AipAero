"""Pre-merge integrity guard for the OurAirports info-page crawlers.

Info-page countries (gated AIP portals - no chart crawl) all share the same
shape: read the OurAirports CSV, keep this country's real-ICAO aerodromes, emit
`vfr` rows whose `url` is the provider portal and with no `pdf_url`. A regression
in that path (0 airports, or a broken title) would ship an EMPTY or garbled
airport-list page - exactly the kind of thing that is invisible in a DB-less CI
build. This test runs each info-page crawler against a mocked OurAirports CSV
(no network) and asserts the two invariants that drive the list page and the map
marker labels:

  1. it yields >= 1 aerodrome for its country, and
  2. every title obeys the hard "<name> <ICAO>" rule (ends with a 4-letter ICAO,
     is not the bare ICAO, and is not empty).

When a NEW info-page country is onboarded, add its crawler class below (the same
place its `gatedCountries` / message files get added).
"""

from __future__ import annotations

import pytest

from crawlers.az import AZ
from crawlers.bg import BG
from crawlers.by import BY
from crawlers.ch import CH
from crawlers.hr import HR
from crawlers.it import IT
from crawlers.md import MD
from crawlers.mt import MT
from crawlers.tr import TR
from crawlers.ua import UA
from crawlers.uz import UZ

# Every OurAirports-backed info-page crawler. Keep in sync with `gatedCountries`
# in src/lib/utils.ts (the website's gated set) - these are the countries that
# link a portal instead of crawling charts.
INFO_PAGE_CRAWLERS = [AZ, BG, BY, CH, HR, IT, MD, MT, TR, UA, UZ]


class _FakeResp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        pass


def _csv_for(cc: str) -> str:
    """A minimal OurAirports CSV with two valid aerodromes for country `cc`
    (a 4-letter-ICAO large field + a small field whose ICAO is only in `ident`),
    plus noise rows the crawler must drop (heliport, non-4-letter, wrong
    country, closed)."""
    return (
        '"id","ident","type","name","iso_country","icao_code"\n'
        f'"1","{cc}XA","large_airport","{cc} International","{cc}","{cc}XA"\n'
        f'"2","{cc}XB","small_airport","{cc} Airfield","{cc}",""\n'
        f'"3","{cc}XH","heliport","{cc} Hospital Helipad","{cc}","{cc}XH"\n'
        f'"4","{cc}9","small_airport","{cc} Strip","{cc}","{cc}9"\n'
        f'"5","XCLD","closed","{cc} Old","{cc}","{cc}ZZ"\n'
        '"6","LOWW","large_airport","Vienna","AT","LOWW"\n'
    )


@pytest.mark.parametrize("cls", INFO_PAGE_CRAWLERS, ids=lambda c: c.__name__)
def test_infopage_yields_valid_titles(cls, monkeypatch):
    crawler = cls()
    cc = crawler.country
    monkeypatch.setattr(
        crawler.client,
        "get",
        lambda url, timeout=60: _FakeResp(_csv_for(cc)),
    )
    try:
        airports = crawler.crawl()
    finally:
        crawler.close()

    # 1. Non-empty: an info-page that yields nothing renders an EMPTY list page.
    assert airports, f"{cc}: info-page crawler produced 0 aerodromes"

    for a in airports:
        assert a.country == cc, f"{cc}: wrong country on {a.title!r}"
        assert a.airport_type == "vfr", f"{cc}: {a.title!r} not vfr"
        assert a.url and a.url.startswith("http"), f"{cc}: {a.title!r} bad url"
        assert a.pdf_url is None, f"{cc}: info-page {a.title!r} has a pdf_url"
        # 2. Hard "<name> <ICAO>" title rule (list row + map marker label).
        assert a.icao, f"{cc}: info-page aerodrome {a.title!r} has no ICAO"
        assert a.title.endswith(a.icao), (
            f"{cc}: title {a.title!r} is not '<name> <ICAO>'"
        )
        assert a.title.strip().upper() != a.icao, (
            f"{cc}: bare-ICAO title {a.title!r} (missing the place name)"
        )


def test_all_info_page_crawlers_are_registered():
    """The tested set matches what main.py actually schedules (no crawler is
    silently dropped from the integrity check)."""
    from main import COUNTRY_CRAWLERS

    for cls in INFO_PAGE_CRAWLERS:
        assert cls in COUNTRY_CRAWLERS.values(), (
            f"{cls.__name__} is not registered in main.COUNTRY_CRAWLERS"
        )
