"""Unit tests for the France crawler's edition selection and resilience.

FR resolves the effective eAIP edition from the SIA "object" document
(`…/index-fr-FR.html`) and parses four menu sections (IFR/VFR/MIL
aerodromes + heliports). The hardened crawler:

  - picks the latest edition whose date is on/before today when the object
    doc lists several, and falls back to the first index link otherwise;
  - normalises Windows-style backslashes in hrefs;
  - parses each section independently, so one missing section no longer
    empties the whole country.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers.fr import FR, ROOT_URL

OBJ_URL = "https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_.../object.html"


@pytest.fixture
def fr() -> FR:
    crawler = FR()
    yield crawler
    crawler.close()


# ----- date extraction --------------------------------------------------------


def test_extract_date_iso_form(fr: FR):
    assert fr._extract_date("eAIP/2026_06_11/FR/index-fr-FR.html") == datetime.date(
        2026, 6, 11
    )


def test_extract_date_day_first_form(fr: FR):
    assert fr._extract_date("eAIP_11-06-2026/FRANCE/index-fr-FR.html") == datetime.date(
        2026, 6, 11
    )


def test_extract_date_none_when_absent(fr: FR):
    assert fr._extract_date("FRANCE/index-fr-FR.html") is None


# ----- edition selection ------------------------------------------------------


def test_selects_current_edition_by_date(fr: FR):
    html = """
      <a href="eAIP_2026-06-11/FR/index-fr-FR.html">current</a>
      <a href="eAIP_2026-07-09/FR/index-fr-FR.html">next</a>
    """
    url = fr._resolve_current_edition_url(
        OBJ_URL, html, today=datetime.date(2026, 7, 8)
    )
    assert "2026-06-11" in url


def test_switches_on_effective_date(fr: FR):
    html = """
      <a href="eAIP_2026-06-11/FR/index-fr-FR.html">current</a>
      <a href="eAIP_2026-07-09/FR/index-fr-FR.html">next</a>
    """
    url = fr._resolve_current_edition_url(
        OBJ_URL, html, today=datetime.date(2026, 7, 9)
    )
    assert "2026-07-09" in url


def test_single_undated_edition_falls_back_to_first(fr: FR):
    html = '<a href="FRANCE/index-fr-FR.html">eAIP FRANCE</a>'
    url = fr._resolve_current_edition_url(
        OBJ_URL, html, today=datetime.date(2026, 7, 8)
    )
    assert url.endswith("/FRANCE/index-fr-FR.html")


def test_backslash_is_normalised(fr: FR):
    html = r'<a href="eAIP_2026-06-11\FR\index-fr-FR.html">current</a>'
    url = fr._resolve_current_edition_url(
        OBJ_URL, html, today=datetime.date(2026, 7, 8)
    )
    assert "\\" not in url and "index-fr-FR.html" in url


def test_missing_edition_link_raises(fr: FR):
    with pytest.raises(ValueError, match="index-fr-FR.html"):
        fr._resolve_current_edition_url(
            OBJ_URL, "<a href='nope.html'>x</a>", today=datetime.date(2026, 7, 8)
        )


# ----- eAIP FRANCE link discovery ---------------------------------------------


def _soup(fr: FR, html: str):
    return fr.soup(html)


def test_finds_eaip_france_in_header_dropdown(fr: FR):
    html = (
        "<nav><ul class='dropdown'>"
        "<li><a href='eAIP_France.php'>eAIP FRANCE</a></li>"
        "<li><a href='eAIP_CarSamNam.php'>eAIP CAR SAM NAM</a></li>"
        "<li><a href='eAIP_PacN.php'>eAIP PAC N</a></li>"
        "</ul></nav>"
    )
    link = fr._find_eaip_france_link(_soup(fr, html))
    assert link is not None
    assert link["href"] == "eAIP_France.php"


def test_finds_eaip_france_in_legacy_div(fr: FR):
    html = (
        "<div id='block-plandesite'><h2>AIP</h2>"
        "<a href='eAIP_France.php'>eAIP FRANCE</a></div>"
    )
    link = fr._find_eaip_france_link(_soup(fr, html))
    assert link is not None
    assert link["href"] == "eAIP_France.php"


def test_does_not_pick_sibling_regions(fr: FR):
    # Only the non-France regions are present — must return None, never a
    # near-miss like "eAIP CAR SAM NAM".
    html = (
        "<a href='eAIP_CarSamNam.php'>eAIP CAR SAM NAM</a>"
        "<a href='eAIP_PacN.php'>eAIP PAC N</a>"
        "<a href='eAIP_Run.php'>eAIP RUN</a>"
    )
    assert fr._find_eaip_france_link(_soup(fr, html)) is None


def test_matches_eaip_france_with_extra_whitespace(fr: FR):
    html = "<a href='eAIP_France.php'>  eAIP\n  FRANCE  </a>"
    link = fr._find_eaip_france_link(_soup(fr, html))
    assert link is not None
    assert link["href"] == "eAIP_France.php"


# ----- per-section resilience (end-to-end with a mocked chain) ----------------


def _section(section_id: str, icao: str) -> str:
    """One eurocontrol title/details pair under a section container."""
    return (
        f"<div id='menu-{section_id}'>"
        f"<div><a href='ad/{icao}.html'>{icao} {icao} TOWN</a></div>"
        f"<div><div><a href='charts/{icao}.pdf' title='Charts related to an Aerodrome'>c</a></div></div>"
        f"</div>"
    )


def test_crawl_tolerates_missing_sections(fr: FR, monkeypatch):
    plandesite = (
        "<div id='block-plandesite'><h2>AIP</h2>"
        "<a href='eAIP_France.php'>eAIP FRANCE</a></div>"
    )
    eaip_pre = "<object data='object.html'></object>"
    object_html = '<a href="eAIP_2026-06-11/FR/index-fr-FR.html">current</a>'
    # Only VFR aerodromes and heliports are present; IFR + MIL are absent.
    nav_html = (
        "<html><body>"
        + _section("AD-2-VFRdetails", "LFPG")
        + _section("AD-3details", "LFPH")
        + "</body></html>"
    )

    pages = {
        ROOT_URL: plandesite,
        "https://www.sia.aviation-civile.gouv.fr/eAIP_France.php": eaip_pre,
    }

    def fake_fetch(url, **kwargs):
        if "object.html" in url:
            return object_html
        return pages[url]

    monkeypatch.setattr(fr, "fetch", fake_fetch)
    monkeypatch.setattr(
        fr, "follow_frame_chain", lambda edition_url, frames: (edition_url, nav_html)
    )

    airports = fr.crawl()
    icaos = sorted(a.icao for a in airports)
    types = {a.airport_type for a in airports}
    assert icaos == ["LFPG", "LFPH"]  # IFR/MIL skipped, VFR+heli kept
    # France folds heliports (AD 3) into the `aeroport` type — it has no
    # separate heliports page — so both surviving sections are `aeroport`.
    assert types == {"aeroport"}


def test_crawl_raises_when_no_section_parses(fr: FR, monkeypatch):
    plandesite = (
        "<div id='block-plandesite'><h2>AIP</h2>"
        "<a href='eAIP_France.php'>eAIP FRANCE</a></div>"
    )
    monkeypatch.setattr(
        fr,
        "fetch",
        lambda url, **k: (
            "<object data='object.html'></object>"
            if url.endswith("eAIP_France.php")
            else '<a href="eAIP_2026-06-11/FR/index-fr-FR.html">c</a>'
            if "object.html" in url
            else plandesite
        ),
    )
    monkeypatch.setattr(
        fr,
        "follow_frame_chain",
        lambda edition_url, frames: (edition_url, "<html><body></body></html>"),
    )
    # Don't let the error path litter error_logs/ during tests.
    monkeypatch.setattr(fr, "save_response", lambda *a, **k: None)
    with pytest.raises(ValueError, match="No FR sections"):
        fr.crawl()
