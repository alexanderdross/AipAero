"""Unit tests for the Austria crawler's table parser.

AT.extract_airports parses a simple HTML table where each row is one
aerodrome: first cell holds one or two `<a>`s (ICAO link + chart link),
second cell is the city. The "AD 3" section header row must be skipped.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers.at import AT, COUNTRY, ROOT_URL


@pytest.fixture
def at() -> AT:
    crawler = AT()
    yield crawler
    crawler.close()


_BASE_URL = "https://eaip.austrocontrol.at/2026-01/"

# Trimmed but faithful copy of the real Austrocontrol root page: one current
# edition (`<tr class="current">`) plus three future ones, followed by the
# "Additional products and services" table whose links must never be picked.
ROOT_HTML = """
<table border="1">
  <tr>
    <th>Gültig von<br><i>Valid from</i></th>
    <th>Gültig bis<br><i>Valid until</i></th>
    <th>Luftfahrthandbuch<br><i>Aeronautical Information Publication</i></th>
  </tr>
  <tr class="current">
    <td>12 JUN 2026</td><td>08 JUL 2026</td>
    <td><b><a href="./lo/260612/index.htm" target="_blank">aktuelle Ausgabe / current version</a></b></td>
  </tr>
  <tr class="future">
    <td>09 JUL 2026</td><td>09 JUL 2026</td>
    <td><b><a href="./lo/260709/index.htm" target="_blank">zukünftige Ausgabe / future version</a></b></td>
  </tr>
  <tr class="future">
    <td>10 JUL 2026</td><td>05 AUG 2026</td>
    <td><b><a href="./lo/260710/index.htm" target="_blank">zukünftige Ausgabe / future version</a></b></td>
  </tr>
  <tr class="future">
    <td>06 AUG 2026</td><td>UFN</td>
    <td><b><a href="./lo/260806/index.htm" target="_blank">zukünftige Ausgabe / future version</a></b></td>
  </tr>
</table>
<table>
  <tr><td><a href="https://www.austrocontrol.at/piloten/aip_sup">AIP SUP</a></td></tr>
  <tr><td><a href="https://maps.austrocontrol.at/">Onlinekarten</a></td></tr>
</table>
"""


def _patch_fetch(at: AT, html: str) -> None:
    """Replace the network call with a fixed HTML body."""
    at.fetch_iso = lambda url: html  # type: ignore[method-assign]


# ----- happy path -------------------------------------------------------------


def test_uses_last_link_in_first_cell_for_href(at: AT):
    html = """<table>
      <tr>
        <td><a href='ad/LOWW/'>LOWW</a><a href='ad/LOWW/index.html'>chart</a></td>
        <td>Wien-Schwechat</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    [airport] = at.extract_airports(_BASE_URL, "vfr")
    assert airport.icao == "LOWW"
    assert airport.title == "Wien-Schwechat LOWW"
    assert airport.url == _BASE_URL + "ad/LOWW/index.html"
    assert airport.airport_type == "vfr"
    assert airport.country == COUNTRY


def test_single_link_row_uses_that_link(at: AT):
    html = """<table>
      <tr>
        <td><a href='ad/LOWS/index.pdf'>LOWS</a></td>
        <td>Salzburg</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    [airport] = at.extract_airports(_BASE_URL, "vfr")
    assert airport.icao == "LOWS"
    assert airport.url == _BASE_URL + "ad/LOWS/index.pdf"


# ----- skip rules -------------------------------------------------------------


def test_section_header_row_AD_3_is_skipped(at: AT):
    html = """<table>
      <tr>
        <td><a href='ad/AD3.html'>AD 3</a></td>
        <td>(section header — must skip)</td>
      </tr>
      <tr>
        <td><a href='ad/LOWG/index.pdf'>LOWG</a></td>
        <td>Graz</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    airports = at.extract_airports(_BASE_URL, "vfr")
    icaos = [a.icao for a in airports]
    assert icaos == ["LOWG"]  # AD 3 row dropped


def test_row_with_only_one_cell_is_skipped(at: AT):
    html = """<table>
      <tr><td>orphan cell</td></tr>
      <tr>
        <td><a href='ad/LOWI/index.pdf'>LOWI</a></td>
        <td>Innsbruck</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    airports = at.extract_airports(_BASE_URL, "vfr")
    assert [a.icao for a in airports] == ["LOWI"]


def test_row_without_any_anchor_is_skipped(at: AT):
    html = """<table>
      <tr>
        <td>no link</td>
        <td>City</td>
      </tr>
      <tr>
        <td><a href='ad/LOWK/index.pdf'>LOWK</a></td>
        <td>Klagenfurt</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    airports = at.extract_airports(_BASE_URL, "vfr")
    assert [a.icao for a in airports] == ["LOWK"]


def test_anchor_without_href_is_skipped(at: AT):
    html = """<table>
      <tr>
        <td><a>LOXY</a></td>
        <td>Should be skipped (no href)</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    assert at.extract_airports(_BASE_URL, "vfr") == []


# ----- edge cases -------------------------------------------------------------


def test_relative_href_is_resolved_against_base_url(at: AT):
    html = """<table>
      <tr>
        <td><a href='charts/LOXR.pdf'>LOXR</a></td>
        <td>Linz</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    [airport] = at.extract_airports(_BASE_URL, "vfr")
    assert airport.url == _BASE_URL + "charts/LOXR.pdf"


def test_airport_type_is_threaded_through(at: AT):
    html = """<table>
      <tr>
        <td><a href='heli/LOXH.pdf'>LOXH</a></td>
        <td>A heliport</td>
      </tr>
    </table>"""
    _patch_fetch(at, html)
    [airport] = at.extract_airports(_BASE_URL, "heliport")
    assert airport.airport_type == "heliport"


# ----- current-edition selection ----------------------------------------------


def test_selects_current_row_edition(at: AT):
    # The `<tr class="current">` row wins over the three future editions.
    url = at._find_current_edition_url(
        ROOT_URL, ROOT_HTML, today=datetime.date(2026, 7, 8)
    )
    assert url == "https://eaip.austrocontrol.at/lo/260612/index.htm"


def test_future_editions_are_never_selected(at: AT):
    url = at._find_current_edition_url(
        ROOT_URL, ROOT_HTML, today=datetime.date(2026, 7, 8)
    )
    assert "260709" not in url
    assert "260710" not in url
    assert "260806" not in url


def test_additional_product_links_are_ignored(at: AT):
    url = at._find_current_edition_url(
        ROOT_URL, ROOT_HTML, today=datetime.date(2026, 7, 8)
    )
    assert "austrocontrol.at/lo/" in url  # an edition link, not a product link


def test_falls_back_to_label_without_current_class(at: AT):
    # No class marker at all — the "current version" label must still win.
    html = (
        '<table><tr><td><a href="./lo/260612/index.htm">'
        "aktuelle Ausgabe / current version</a></td></tr>"
        '<tr><td><a href="./lo/260709/index.htm">'
        "zukünftige Ausgabe / future version</a></td></tr></table>"
    )
    url = at._find_current_edition_url(
        ROOT_URL, html, today=datetime.date(2026, 7, 8)
    )
    assert url.endswith("/lo/260612/index.htm")


def test_falls_back_to_date_without_class_or_label(at: AT):
    # Neither class nor label — pick the latest edition on/before today by
    # the YYMMDD embedded in the href.
    html = (
        '<table><tr><td><a href="./lo/260612/index.htm">Edition A</a></td></tr>'
        '<tr><td><a href="./lo/260709/index.htm">Edition B</a></td></tr></table>'
    )
    url = at._find_current_edition_url(
        ROOT_URL, html, today=datetime.date(2026, 7, 8)
    )
    assert url.endswith("/lo/260612/index.htm")


def test_date_fallback_switches_on_effective_date(at: AT):
    html = (
        '<table><tr><td><a href="./lo/260612/index.htm">Edition A</a></td></tr>'
        '<tr><td><a href="./lo/260709/index.htm">Edition B</a></td></tr></table>'
    )
    url = at._find_current_edition_url(
        ROOT_URL, html, today=datetime.date(2026, 7, 9)
    )
    assert url.endswith("/lo/260709/index.htm")


def test_no_edition_link_raises(at: AT):
    with pytest.raises(ValueError, match="No current-edition link"):
        at._find_current_edition_url(
            ROOT_URL,
            "<table><tr><td><a href='./products.htm'>x</a></td></tr></table>",
            today=datetime.date(2026, 7, 8),
        )


# ----- find_link_by_text robustness -------------------------------------------


def test_find_link_by_text_matches_nested_markup(at: AT):
    soup = at.soup("<a href='ad.htm'><b>Part III - AD</b></a>")
    assert at.find_link_by_text(soup, "Part III - AD") == "ad.htm"


def test_find_link_by_text_normalises_whitespace(at: AT):
    soup = at.soup("<a href='ad.htm'>Part III   -   AD</a>")
    assert at.find_link_by_text(soup, "Part III - AD") == "ad.htm"


def test_find_link_by_text_returns_none_when_absent(at: AT):
    soup = at.soup("<a href='x.htm'>Part I - GEN</a>")
    assert at.find_link_by_text(soup, "Part III - AD") is None


# ----- AD 2.3 operating hours -------------------------------------------------

_WINDOW_0700_1700 = {
    "kind": "window",
    "open": {"t": "time", "m": 7 * 60},
    "close": {"t": "time", "m": 17 * 60},
}
_UNKNOWN = {"kind": "unknown"}

# The field's AD 2 page carries a real AD 2.3 OPERATIONAL HOURS table: row 1 is
# the aerodrome operator (MON-FRI 0700-1700), row 2 the H24 customs service that
# must NOT leak into the aerodrome hours.
_FIELD_AD2_HTML = """<html><body>
  <h3>LOWX AD 2.3 OPERATIONAL HOURS</h3>
  <table>
    <tr><td>1</td><td>Aerodrome operator</td><td>MON-FRI 0700-1700</td></tr>
    <tr><td>2</td><td>Customs and immigration</td><td>H24</td></tr>
  </table>
  <h3>AD 2.4 HANDLING SERVICES AND FACILITIES</h3>
</body></html>"""


def test_ad23_hours_collected_from_field_page(at: AT):
    """extract_airports fetches each field's AD 2 page and fills
    hours_by_icao from row 1 of its AD 2.3 table (H24 customs row excluded)."""
    listing = """<table>
      <tr>
        <td><a href='ad/LOWX/index.html'>LOWX</a></td>
        <td>Testfield</td>
      </tr>
    </table>"""

    def fetch_iso(url: str) -> str:
        return _FIELD_AD2_HTML if url.endswith("LOWX/index.html") else listing

    at.fetch_iso = fetch_iso  # type: ignore[method-assign]
    [airport] = at.extract_airports(_BASE_URL, "vfr")
    assert airport.icao == "LOWX"
    assert at.hours_by_icao["LOWX"] == [_WINDOW_0700_1700] * 5 + [_UNKNOWN] * 2


def test_ad23_hours_failure_is_soft(at: AT):
    """A field page that raises on fetch must not abort extraction nor record
    hours - the airport still lists."""
    listing = """<table>
      <tr>
        <td><a href='ad/LOWY/index.html'>LOWY</a></td>
        <td>Brokenfield</td>
      </tr>
    </table>"""

    def fetch_iso(url: str) -> str:
        if url.endswith("LOWY/index.html"):
            raise ConnectionError("field page unreachable")
        return listing

    at.fetch_iso = fetch_iso  # type: ignore[method-assign]
    [airport] = at.extract_airports(_BASE_URL, "vfr")
    assert airport.icao == "LOWY"
    assert "LOWY" not in at.hours_by_icao
