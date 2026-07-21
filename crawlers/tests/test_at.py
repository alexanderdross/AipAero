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


# ----- chart naming (right-column description) --------------------------------

# The Austro Control AD-2 chart-index page: LEFT cell links the chart under its
# code, RIGHT cell carries the bilingual name ("German<br><i>English</i>").
_CHART_PAGE_HTML = """<html><body><table>
  <tr>
    <td><a href="Charts/LOWG/LO_AD_2_LOWG_1-1_en.pdf">LOWG AD 2 MAP 1-1</a></td>
    <td>Flugplatzkarte - ICAO<br><i>Aerodrome Chart - ICAO</i></td>
  </tr>
  <tr>
    <td><a href="Charts/LOWG/LO_AD_2_LOWG_14-2_en.pdf">LOWG AD 2 MAP 14-2</a></td>
    <td>Sichtflugkarte INNSBRUCK<br><i>Chart for VFR flights INNSBRUCK</i></td>
  </tr>
</table></body></html>"""
_CHART_BASE = "https://eaip.austrocontrol.at/lo/260710/ad_2_lowg.htm"


def test_chart_names_use_right_column_english_description(at: AT):
    links = at._collect_pdf_links(_CHART_PAGE_HTML, _CHART_BASE)
    names = [name for name, _ in links]
    # The chart's name is the right-column English (italic) line, not the code.
    assert names == ["Aerodrome Chart - ICAO", "Chart for VFR flights INNSBRUCK"]
    # URLs are still resolved absolutely and in document order.
    assert links[0][1].endswith("/Charts/LOWG/LO_AD_2_LOWG_1-1_en.pdf")


def test_primary_pdf_is_the_aerodrome_chart_after_rename(at: AT):
    links = at._collect_pdf_links(_CHART_PAGE_HTML, _CHART_BASE)
    # Renaming the charts to descriptions must not break the primary pick: the
    # aerodrome chart (MAP 1-1) is still chosen, via the filename priority.
    assert at._pick_pdf_url(links).endswith("_1-1_en.pdf")


def test_chart_name_falls_back_to_code_without_description_cell(at: AT):
    html = (
        "<table><tr><td>"
        '<a href="x_5-1_en.pdf">LOWG AD 2 MAP 5-1</a>'
        "</td></tr></table>"
    )
    links = at._collect_pdf_links(html, "https://x/")
    assert links[0][0] == "LOWG AD 2 MAP 5-1"
