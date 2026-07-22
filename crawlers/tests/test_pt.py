"""Unit tests for the Portugal crawler: eVFR-manual merge + AIRAC stamping."""

from __future__ import annotations

import pytest

from crawlers.http_base import current_airac_date
from crawlers.pt import PT


def _chapter(icao: str, name: str) -> str:
    return (
        f'<div><a href="ad/{icao}.html">AD 2.{icao} {name}</a></div>'
        f'<div id="menu-AD-2.{icao}details">'
        f'<div><a href="graphics/{icao}.pdf" title="Charts related to the aerodrome">c</a>'
        f"</div></div>"
    )


EVFR_MENU = f'<div id="menu">{_chapter("LPBR", "BRAGA")}</div>'
NAV_HTML = f'<div id="menu">{_chapter("LPPT", "LISBOA")}</div>'


@pytest.fixture
def crawler() -> PT:
    c = PT()
    yield c
    c.close()


def test_crawl_evfr_extracts_vfr_fields(crawler: PT, monkeypatch):
    monkeypatch.setattr(crawler, "fetch", lambda url: EVFR_MENU)
    airports = crawler._crawl_evfr()
    assert [a.icao for a in airports] == ["LPBR"]
    assert airports[0].airport_type == "vfr"


def test_crawl_evfr_is_fail_soft(crawler: PT, monkeypatch):
    def _boom(url):
        raise RuntimeError("eVFR down")

    monkeypatch.setattr(crawler, "fetch", _boom)
    assert crawler._crawl_evfr() == []  # never raises


def test_crawl_merges_eaip_and_evfr_and_stamps_airac(crawler: PT, monkeypatch):
    monkeypatch.setattr(crawler, "_enter_nav", lambda: ("https://ais.nav.pt/nav.html", NAV_HTML))
    monkeypatch.setattr(crawler, "fetch", lambda url: EVFR_MENU)  # for _crawl_evfr
    monkeypatch.setattr(crawler, "attach_pdf_urls", lambda airports: None)
    monkeypatch.setattr(crawler, "save_response", lambda *a, **k: None)

    airports = crawler.crawl()
    icaos = sorted(a.icao for a in airports)
    assert icaos == ["LPBR", "LPPT"]  # eAIP AD-2 + eVFR merged
    assert crawler.airac == current_airac_date()
