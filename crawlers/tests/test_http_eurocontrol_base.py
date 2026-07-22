"""Unit tests for HttpEurocontrolBase.extract_airports_from_html.

The eAIP navigation menu shape is well-defined (paired title/details
`<div>`s under a section id). We test against synthetic HTML that mirrors
what NL/UK/FR actually serve, including the two real-world quirks:

  - UK appends `TAD_HP;TXT_NAME;NNNN` to titles.
  - The "Charts related to an Aerodrome" `<a title>` should be preferred,
    falling back to the last `<a>` directly under one of the inner divs.
"""

from __future__ import annotations

import pytest

from crawlers.http_eurocontrol_base import HttpEurocontrolBase


class _Concrete(HttpEurocontrolBase):
    def __init__(self, country: str = "NL"):
        super().__init__(country)

    def crawl(self):  # pragma: no cover
        return []


@pytest.fixture
def parser() -> _Concrete:
    p = _Concrete()
    yield p
    p.close()


_BASE_URL = "https://eaip.test/edition/nav.html"


def _menu(items_html: str, section_id: str = "AD-2details") -> str:
    return f"<html><body><div id='menu-{section_id}'>{items_html}</div></body></html>"


# ----- happy path -------------------------------------------------------------


def test_extracts_charts_related_link_when_titled(parser: _Concrete):
    html = _menu(
        """
        <div><a href='ad/EHAM.html'>EHAM AMSTERDAM SCHIPHOL</a></div>
        <div>
          <div><a href='ad/EHAM-text.html' title='Aerodrome text'>text</a></div>
          <div><a href='charts/EHAM.pdf' title='Charts related to an Aerodrome'>charts</a></div>
        </div>
        """
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert airport.country == "NL"
    assert airport.icao == "EHAM"
    assert airport.title == "AMSTERDAM SCHIPHOL EHAM"
    assert airport.url == "https://eaip.test/edition/charts/EHAM.pdf"
    assert airport.airport_type == "vfr"


def test_falls_back_to_last_anchor_when_no_charts_title(parser: _Concrete):
    html = _menu(
        """
        <div><a href='ad/EHRD.html'>EHRD ROTTERDAM</a></div>
        <div><div><a href='charts/EHRD.pdf'>just a link</a></div></div>
        """
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert airport.url == "https://eaip.test/edition/charts/EHRD.pdf"


def test_strips_TAD_HP_suffix_in_uk_titles(parser: _Concrete):
    html = _menu(
        """
        <div><a href='#'></a><a href='ad/EHGG.html'>EHGG GRONINGEN — EELDE TAD_HP;TXT_NAME;1234</a></div>
        <div><div><a href='charts/EHGG.pdf'>x</a></div></div>
        """
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert airport.icao == "EHGG"
    # Em-dash was stripped; whitespace collapsed.
    assert airport.title == "GRONINGEN EELDE EHGG"


def test_uses_last_anchor_text_when_multiple_anchors_in_title(parser: _Concrete):
    """The original Selenium code took the last <a> in the title div; same here."""
    html = _menu(
        """
        <div><a href='/'>home</a><a href='ad/EHAA.html'>EHAA SOMETHING</a></div>
        <div><div><a href='charts/EHAA.pdf'>c</a></div></div>
        """
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert airport.icao == "EHAA"


# ----- ICAO validation --------------------------------------------------------


def test_title_without_icao_keeps_full_name_and_null_icao(parser: _Concrete):
    # A leading token that isn't a 4-letter ICAO code (here a named field
    # with no location indicator) must not be turned into a bogus "code".
    html = _menu(
        """
        <div><a href='ad/x.html'>SEGELFLUGGELANDE SPITZERBERG</a></div>
        <div><div><a href='charts/x.pdf'>c</a></div></div>
        """
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert airport.icao is None
    assert airport.title == "SEGELFLUGGELANDE SPITZERBERG"


def test_four_letter_icao_is_uppercased_and_split(parser: _Concrete):
    html = _menu(
        """
        <div><a href='ad/ehle.html'>ehle LELYSTAD</a></div>
        <div><div><a href='charts/ehle.pdf'>c</a></div></div>
        """
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert airport.icao == "EHLE"
    assert airport.title == "LELYSTAD EHLE"


def test_non_four_letter_leading_token_is_not_an_icao(parser: _Concrete):
    # Five letters, digits, etc. are not ICAO location indicators.
    html = _menu(
        """
        <div><a href='ad/x.html'>HELIPAD CITY HOSPITAL</a></div>
        <div><div><a href='charts/x.pdf'>c</a></div></div>
        """
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert airport.icao is None
    assert airport.title == "HELIPAD CITY HOSPITAL"


# ----- multiple sections / categories -----------------------------------------


def test_returns_one_airport_per_pair(parser: _Concrete):
    html = _menu(
        """
        <div><a href='ad/EHAM.html'>EHAM AMSTERDAM</a></div>
        <div><div><a href='c/EHAM.pdf'>c</a></div></div>
        <div><a href='ad/EHRD.html'>EHRD ROTTERDAM</a></div>
        <div><div><a href='c/EHRD.pdf'>c</a></div></div>
        <div><a href='ad/EHEH.html'>EHEH EINDHOVEN</a></div>
        <div><div><a href='c/EHEH.pdf'>c</a></div></div>
        """
    )
    airports = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    icaos = [a.icao for a in airports]
    assert icaos == ["EHAM", "EHRD", "EHEH"]


def test_category_is_threaded_through(parser: _Concrete):
    html = _menu(
        """
        <div><a href='ad/EHHV.html'>EHHV HILVERSUM</a></div>
        <div><div><a href='c/EHHV.pdf'>c</a></div></div>
        """,
        section_id="AD-3details",
    )
    [airport] = parser.extract_airports_from_html(html, _BASE_URL, "AD-3details", "heliport")
    assert airport.airport_type == "heliport"


# ----- error paths ------------------------------------------------------------


def test_missing_section_div_raises(parser: _Concrete):
    with pytest.raises(ValueError, match="not found"):
        parser.extract_airports_from_html("<html><body></body></html>", _BASE_URL, "AD-2details", "vfr")


def test_empty_section_raises(parser: _Concrete):
    with pytest.raises(ValueError, match="No airports"):
        parser.extract_airports_from_html(_menu(""), _BASE_URL, "AD-2details", "vfr")


def test_pair_without_anchors_in_title_is_skipped_then_section_empty(parser: _Concrete):
    # A title-div without any <a> contributes nothing; if that's the only
    # pair we end up with zero airports and the function raises.
    html = _menu(
        """
        <div>no link here</div>
        <div><div><a href='charts/x.pdf'>c</a></div></div>
        """
    )
    with pytest.raises(ValueError, match="No airports"):
        parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")


# ----- dedup ------------------------------------------------------------------


def test_duplicate_icao_in_section_is_dropped(parser: _Concrete):
    # A menu that lists the same field twice must yield ONE row (first wins),
    # not a duplicate - the API delete+reinsert has no unique constraint.
    html = _menu(
        """
        <div><a href='ad/EHAM.html'>EHAM AMSTERDAM</a></div>
        <div><div><a href='c/EHAM-1.pdf'>c</a></div></div>
        <div><a href='ad/EHAM.html'>EHAM AMSTERDAM DUP</a></div>
        <div><div><a href='c/EHAM-2.pdf'>c</a></div></div>
        """
    )
    airports = parser.extract_airports_from_html(html, _BASE_URL, "AD-2details", "vfr")
    assert [a.icao for a in airports] == ["EHAM"]
    # First occurrence wins.
    assert airports[0].url.endswith("EHAM-1.pdf")
