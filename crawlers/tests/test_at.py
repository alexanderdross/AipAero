"""Unit tests for the Austria crawler's table parser.

AT.extract_airports parses a simple HTML table where each row is one
aerodrome: first cell holds one or two `<a>`s (ICAO link + chart link),
second cell is the city. The "AD 3" section header row must be skipped.
"""

from __future__ import annotations

import pytest

from crawlers.at import AT, COUNTRY


@pytest.fixture
def at() -> AT:
    crawler = AT()
    yield crawler
    crawler.close()


_BASE_URL = "https://eaip.austrocontrol.at/2026-01/"


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
