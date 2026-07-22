"""Unit tests for the Poland crawler: frameset detection, charts-link pick and
AD-4 per-chapter extraction (with dedup)."""

from __future__ import annotations

import pytest

from crawlers.pl import PL


def _chapter(icao: str, name: str) -> str:
    return (
        f'<div><a href="ad/{icao}.html">AD 4 {icao} {name}</a></div>'
        f'<div id="menu-AD 4 {icao}en-GBdetails">'
        f'<div><a href="charts/{icao}.html" title="AD 4 {icao} CHARTS">CHARTS</a></div>'
        f"</div>"
    )


@pytest.fixture
def crawler() -> PL:
    c = PL()
    yield c
    c.close()


# ----- _has_frames ------------------------------------------------------------


def test_has_frames_true_for_named_frame(crawler: PL):
    assert crawler._has_frames('<frameset><frame name="nav" src="x.html"></frameset>')


def test_has_frames_false_without_name_or_src(crawler: PL):
    assert crawler._has_frames("<html><body>hi</body></html>") is False
    assert crawler._has_frames("<iframe></iframe>") is False


# ----- _charts_link -----------------------------------------------------------


def test_charts_link_prefers_english_charts_over_mapy(crawler: PL):
    from bs4 import BeautifulSoup

    details = BeautifulSoup(
        '<div><a href="mapy.html">MAPY</a><a href="charts.html">CHARTS</a></div>',
        "html.parser",
    ).div
    url = crawler._charts_link(details, "https://ais.pansa.pl/eaip/nav.html")
    assert url.endswith("charts.html")


# ----- AD-4 per-chapter extraction -------------------------------------------


def test_extracts_ad4_vfr_fields_deduped(crawler: PL):
    # The same field appears twice (Polish + English subtree) -> one row.
    nav = f'<div id="menu">{_chapter("EPBA", "BIELSKO-BIAŁA")}{_chapter("EPBA", "BIELSKO-BIAŁA")}</div>'
    airports = crawler._extract_airport_sections(nav, "https://ais.pansa.pl/eaip/nav.html")
    assert [a.icao for a in airports] == ["EPBA"]  # deduped
    assert airports[0].airport_type == "vfr"
    assert airports[0].title.endswith("EPBA") and airports[0].title != "EPBA"


def test_empty_nav_raises(crawler: PL):
    with pytest.raises(ValueError):
        crawler._extract_airport_sections("<div>nothing</div>", "u")
