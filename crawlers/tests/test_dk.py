"""Unit tests for the Denmark crawler.

DK renders each page with a headless browser, but the extraction runs on the
resulting HTML with BeautifulSoup - so we test the parsing by feeding static
HTML through a monkeypatched ``render_html`` (no browser needed). We also
assert the fail-soft behaviour when the browser is unavailable.
"""

from __future__ import annotations

import pytest

from crawlers.dk import DK
from crawlers.playwright_base import PlaywrightUnavailable

ROOT = "https://aim.naviair.dk/"

# Minimal faithful-shape navigation: root -> VFR Flight Guide -> Part 3 ->
# AD 2 / AD 3, each an anchor the text-matcher follows; the leaf sections list
# aerodromes with an ADC chart link ("…_ADC_…").
PAGES = {
    ROOT: """
      <a href="/doc/vfg-danmark">02. VFR Flight Guide Danmark</a>
    """,
    "https://aim.naviair.dk/doc/vfg-danmark": """
      <a href="/doc/vfg-part3">VFG Part 3 - FLYVEPLADSER (AD)</a>
    """,
    "https://aim.naviair.dk/doc/vfg-part3": """
      <a href="/doc/ad2">AD 2 - PUBLIC AERODROMES</a>
      <a href="/doc/ad3">AD 3 - HELIPORTS</a>
    """,
    "https://aim.naviair.dk/doc/ad2": """
      <ul>
        <li><a href="/charts/EK_AD_2_EKAT_ADC_en.pdf" title="ADC">Anholt - EKAT</a></li>
        <li><a href="/charts/EK_AD_2_EKEB_ADC_en.pdf" title="ADC">Esbjerg - EKEB</a></li>
      </ul>
    """,
    "https://aim.naviair.dk/doc/ad3": """
      <ul>
        <li><a href="/charts/EK_AD_3_EKCH_ADC_en.pdf" title="ADC">Copenhagen Heliport - EKCH</a></li>
      </ul>
    """,
}


@pytest.fixture
def dk(monkeypatch) -> DK:
    crawler = DK()
    # Serve the static PAGES map instead of launching a browser.
    monkeypatch.setattr(crawler, "render_html", lambda url, **_: PAGES[url])
    yield crawler
    crawler.close()


def test_crawls_public_aerodromes_and_heliports(dk: DK):
    airports = dk.crawl()
    by_icao = {a.icao: a for a in airports}
    assert set(by_icao) == {"EKAT", "EKEB", "EKCH"}


def test_type_mapping_ad2_vfr_ad3_heliport(dk: DK):
    airports = {a.icao: a for a in dk.crawl()}
    assert airports["EKAT"].airport_type == "vfr"
    assert airports["EKEB"].airport_type == "vfr"
    assert airports["EKCH"].airport_type == "heliport"


def test_title_moves_icao_to_end_and_drops_separator(dk: DK):
    airports = {a.icao: a for a in dk.crawl()}
    assert airports["EKAT"].title == "Anholt EKAT"


def test_chart_url_is_the_adc_link(dk: DK):
    airports = {a.icao: a for a in dk.crawl()}
    assert airports["EKAT"].url.endswith("EK_AD_2_EKAT_ADC_en.pdf")


def test_missing_browser_fails_soft_to_empty(monkeypatch):
    crawler = DK()

    def no_browser(*_a, **_k):
        raise PlaywrightUnavailable("no browser on this host")

    monkeypatch.setattr(crawler, "render_html", no_browser)
    # Must NOT raise - the nightly run keeps publishing the other countries.
    assert crawler.crawl() == []
