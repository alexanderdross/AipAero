"""Unit tests for the Denmark crawler.

DK walks the Naviair Umbraco JSON tree API (getnodesforparent) - so we test
the walk and extraction by monkeypatching ``_nodes`` with a static tree of
the shape the live capture revealed (run 29289869395): folders carry
``isDir``/``hasChildren``, leaf documents carry ``href``. We also assert the
fail-soft behaviour when the API is unreachable and when the render
diagnostics fallback has no browser.
"""

from __future__ import annotations

import pytest

from crawlers.dk import DK
from crawlers.playwright_base import PlaywrightUnavailable


def _dir(node_id: int, name: str) -> dict:
    return {
        "id": node_id,
        "name": name,
        "title": name,
        "isDir": True,
        "hasChildren": True,
        "href": None,
        "link": None,
    }


def _doc(node_id: int, name: str, href: str) -> dict:
    return {
        "id": node_id,
        "name": name,
        "title": name,
        "isDir": False,
        "hasChildren": False,
        "href": href,
        "link": None,
    }


# Minimal faithful-shape tree: root -> VFR Flight Guide -> Part 3 ->
# AD 2 / AD 3; airfield folders hold chart documents (the ADC among them).
NODES: dict[object, list[dict]] = {
    "": [
        _dir(295, "AIP Danmark"),
        _dir(1, "VFR Flight Guide Danmark"),
    ],
    1: [_dir(10, "VFG Part 3 - FLYVEPLADSER (AD)")],
    10: [
        # Decoy first: contains "HELIPORTS" but is the intro chapter - the
        # matcher must prefer the node matching ALL needles (live regression,
        # run 29291001169 extracted "heliports" from the AD 1 intro).
        _dir(19, "AD 1 - AERODROMES_HELIPORTS - INTRODUCTION"),
        _dir(20, "AD 2 - PUBLIC AERODROMES"),
        _dir(21, "AD 3 - HELIPORTS"),
    ],
    19: [_doc(210, "AD 1 intro", "/media/files/intro/EK_AD_1_intro_en.pdf")],
    20: [
        _dir(100, "Anholt - EKAT"),
        _dir(101, "Esbjerg - EKEB"),
    ],
    21: [
        # Chapter intro PDF directly under the section: must be skipped
        # (live regression - shipped as an ICAO-less "heliport").
        _doc(211, "EK_AD_3_1_en.pdf", "/media/files/intro/EK_AD_3_1_en.pdf"),
        _dir(102, "Copenhagen Heliport - EKCH"),
    ],
    100: [
        _doc(200, "EK_AD_2_EKAT_VAC_en", "/charts/EK_AD_2_EKAT_VAC_en.pdf"),
        _doc(201, "EK_AD_2_EKAT_ADC_en", "/charts/EK_AD_2_EKAT_ADC_en.pdf"),
    ],
    101: [_doc(202, "EK_AD_2_EKEB_ADC_en", "/charts/EK_AD_2_EKEB_ADC_en.pdf")],
    102: [_doc(203, "EK_AD_3_EKCH_ADC_en", "/charts/EK_AD_3_EKCH_ADC_en.pdf")],
}


@pytest.fixture
def dk(monkeypatch) -> DK:
    crawler = DK()
    monkeypatch.setattr(crawler, "_nodes", lambda parent_id="": NODES.get(parent_id, []))
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
    # The ADC wins as the main link even though the VAC is listed first.
    assert airports["EKAT"].url.endswith("EK_AD_2_EKAT_ADC_en.pdf")
    assert airports["EKAT"].pdf_url == airports["EKAT"].url


def test_all_documents_become_charts(dk: DK):
    airports = {a.icao: a for a in dk.crawl()}
    charts = airports["EKAT"].charts
    assert charts is not None and len(charts) == 2
    assert {c.url.rsplit("/", 1)[-1] for c in charts} == {
        "EK_AD_2_EKAT_VAC_en.pdf",
        "EK_AD_2_EKAT_ADC_en.pdf",
    }


# ----- AD 2.3 operating hours -------------------------------------------------

_WINDOW_0700_1700 = {
    "kind": "window",
    "open": {"t": "time", "m": 7 * 60},
    "close": {"t": "time", "m": 17 * 60},
}
_UNKNOWN = {"kind": "unknown"}

# EKAT gains the section-less aerodrome-DATA sheet (EK_AD_2_EKAT_en.pdf, the
# "01. AD 2 <ICAO> text" document) that carries the "4. Operational hours"
# table; the VAC/ADC chart docs never match the data-sheet regex, so only this
# sheet is read for hours.
_HOURS_NODES: dict[object, list[dict]] = {
    "": [_dir(1, "VFR Flight Guide Danmark")],
    1: [_dir(10, "VFG Part 3 - FLYVEPLADSER (AD)")],
    10: [_dir(20, "AD 2 - PUBLIC AERODROMES")],
    20: [_dir(100, "Anholt - EKAT")],
    100: [
        _doc(200, "EK_AD_2_EKAT_VAC_en", "/charts/EK_AD_2_EKAT_VAC_en.pdf"),
        _doc(201, "EK_AD_2_EKAT_ADC_en", "/charts/EK_AD_2_EKAT_ADC_en.pdf"),
        _doc(202, "EK_AD_2_EKAT_en", "/media/files/EK_AD_2_EKAT_en.pdf"),
    ],
}

# Naviair "VFR Flight Guide" flat layout: the aerodrome window is item 4's
# `AD:` row (isolated from the H24 ADO/ARO service rows around it).
_DATA_SHEET_TEXT = (
    "VFR Flight Guide Denmark AD 2. EKAT - 1 NAVIAIR "
    "3. Approved for VMC day operations "
    "4. Operational hours AD: MON-FRI 0700-1700 ADO: H24 ARO: H24 "
    "5. Customs/Immigration H24"
)


def test_ad23_hours_from_data_sheet(monkeypatch):
    crawler = DK()
    monkeypatch.setattr(
        crawler, "_nodes", lambda parent_id="": _HOURS_NODES.get(parent_id, [])
    )

    def fake_pdf_text(url: str) -> str:
        # Only the section-less data sheet carries the AD 2.3 table.
        return _DATA_SHEET_TEXT if url.endswith("EK_AD_2_EKAT_en.pdf") else ""

    monkeypatch.setattr(crawler, "pdf_text", fake_pdf_text)
    crawler.crawl()
    crawler.close()
    assert crawler.hours_by_icao["EKAT"] == [_WINDOW_0700_1700] * 5 + [_UNKNOWN] * 2


def test_ad23_hours_soft_when_pdf_text_raises(monkeypatch):
    crawler = DK()
    monkeypatch.setattr(
        crawler, "_nodes", lambda parent_id="": _HOURS_NODES.get(parent_id, [])
    )

    def boom(url: str) -> str:
        raise ValueError("pdf parse failed")

    monkeypatch.setattr(crawler, "pdf_text", boom)
    airports = crawler.crawl()
    crawler.close()
    # The field still lists; no hours recorded.
    assert "EKAT" in {a.icao for a in airports}
    assert "EKAT" not in crawler.hours_by_icao


def test_unreachable_api_fails_soft_to_empty(monkeypatch):
    crawler = DK()

    def boom(parent_id=""):
        raise ConnectionError("api unreachable")

    monkeypatch.setattr(crawler, "_nodes", boom)
    assert crawler.crawl() == []


def test_empty_tree_falls_back_to_render_diagnostics(monkeypatch):
    """No matching root node -> the render diagnostics run, and a missing
    browser there must stay soft (0 airports, no crash)."""
    crawler = DK()
    monkeypatch.setattr(crawler, "_nodes", lambda parent_id="": [])

    def no_browser(*args, **kwargs):
        raise PlaywrightUnavailable("no chromium on this host")

    monkeypatch.setattr(crawler, "render_html", no_browser)
    assert crawler.crawl() == []
