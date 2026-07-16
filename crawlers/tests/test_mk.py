"""Unit tests for the North Macedonia crawler (M-NAV custom eAIP).

Covers the no-JS nav-page parse: which anchors become aerodrome fields and
which (section header, GEN/AD index PDFs) are skipped. No network - the live
fetch + chart-PDF attach are exercised by the live test.
"""

from __future__ import annotations

import pytest

from crawlers import mk as mk_module
from crawlers.mk import MK


@pytest.fixture
def mk() -> MK:
    crawler = MK()
    yield crawler
    crawler.close()


# Mirrors the real index-nonframe.htm: two aerodrome links plus the "AD 2
# Aerodromes" section header and a GEN/AD index PDF link that must be ignored.
_NAV = """
<a href="../html/aerodromes.htm">AD 2 Aerodromes</a>
<a href="../pdf/aerodromes/LW_AD_1_3_en.pdf">AD 1.3 Index to aerodromes and heliports</a>
<a href="../html/lwsk.htm">LWSK - Skopje</a>
<a href="../html/lwoh.htm">LWOH - Ohrid</a>
<a href="../html/lwsk.htm">LWSK - Skopje</a>
"""


def test_module_nav_is_m_nav():
    assert mk_module.NAV_URL.startswith("https://ais.m-nav.info/eAIP/current/")


def test_extract_airports_reads_aerodrome_links(mk: MK):
    airports = mk._extract_airports(_NAV)
    # Two distinct aerodromes; the duplicate LWSK anchor is deduped.
    assert {a.icao for a in airports} == {"LWSK", "LWOH"}
    assert all(a.airport_type == "vfr" and a.country == "MK" for a in airports)
    skopje = next(a for a in airports if a.icao == "LWSK")
    assert skopje.title == "Skopje LWSK"
    # url + pdf_url point at the combined AD 2 PDF built from the ICAO.
    assert skopje.url.endswith("/pdf/aerodromes/LW_AD_2_LWSK_en.pdf")
    assert skopje.pdf_url == skopje.url
    assert skopje.charts and skopje.charts[0].url == skopje.url


def test_extract_airports_skips_section_header_and_index(mk: MK):
    airports = mk._extract_airports(_NAV)
    # "AD 2 Aerodromes" (aerodromes.htm) and the AD 1.3 index PDF are not fields.
    assert all(a.icao in {"LWSK", "LWOH"} for a in airports)
    assert all(a.url.endswith("_en.pdf") for a in airports)


def test_extract_airports_no_links_raises(mk: MK):
    with pytest.raises(ValueError):
        mk._extract_airports("<html><a href='/x'>nothing</a></html>")
