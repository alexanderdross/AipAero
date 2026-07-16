"""Unit tests for the Romania crawler (AISRO static per-edition DOCS tree).

Covers the edition-by-date resolution off the aip.php landing page and the AD2
directory-listing parse into per-aerodrome chart-PDF fields. No network - the
live fetch is exercised by the live test.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import ro as ro_module
from crawlers.ro import RO


@pytest.fixture
def ro() -> RO:
    crawler = RO()
    yield crawler
    crawler.close()


# The live landing uses RELATIVE hrefs ("2026-07-09/index.html", relative to
# /aip/aip.php); mix relative + absolute here so the urljoin resolution is
# covered by the test.
_LANDING = """
<a href="2026-05-14/index.html">Old edition</a>
<a href="2026-07-09/index.html">Click here to access AIP ROMANIA</a>
<a href="/aip/2026-09-03/index.html">Future edition</a>
<a href="https://www.romatsa.ro/">ROMATSA</a>
"""

# Mirrors the Apache directory listing of .../DOCS/AIP/AD/AD2/.
_AD2_LISTING = """
<a href="?C=N;O=D">Name</a>
<a href="/aip/2026-07-09/DOCS/AIP/AD/">Parent Directory</a>
<a href="AD_2_5_LROP/">AD_2_5_LROP/</a>
<a href="AD_2_7_LRCL/">AD_2_7_LRCL/</a>
<a href="AD_2_16_LRTR/">AD_2_16_LRTR/</a>
<a href="AD_2_5_LROP/">AD_2_5_LROP/</a>
"""


def test_module_landing_is_aisro():
    assert ro_module.LANDING_URL == "https://www.aisro.ro/aip/aip.php"


def test_resolve_edition_picks_effective(ro: RO):
    edition = ro._resolve_edition(_LANDING, today=datetime.date(2026, 7, 16))
    # 2026-07-09 is the latest edition on/before 16 JUL 2026 (09 SEP is future).
    assert edition == "2026-07-09"


def test_resolve_edition_no_link_raises(ro: RO):
    with pytest.raises(ValueError):
        ro._resolve_edition("<html><a href='/x'>nothing</a></html>")


def test_crawl_ad2_builds_pdf_fields(ro: RO, monkeypatch):
    monkeypatch.setattr(ro, "fetch", lambda url: _AD2_LISTING)
    base = "https://www.aisro.ro/aip/2026-07-09/DOCS/AIP/AD/AD2/"
    airports = ro._crawl_ad2(base)
    # Three distinct aerodromes; the duplicate LROP folder is deduped.
    assert {a.icao for a in airports} == {"LROP", "LRCL", "LRTR"}
    lrop = next(a for a in airports if a.icao == "LROP")
    assert lrop.url.endswith("AD_2_5_LROP/LR_AD_2_LROP_en.pdf")
    assert lrop.pdf_url == lrop.url
    assert lrop.title == "Bucuresti / Henri Coanda LROP"
    assert all(a.airport_type == "vfr" and a.country == "RO" for a in airports)
