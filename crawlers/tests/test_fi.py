"""Unit tests for the Finland crawler's pure helpers.

FI reads field names from the Fintraffic menu anchor ids and rewrites each AD-2
sub-page URL to the full-aerodrome chart-index page (section "1-fi-FI").
"""

from __future__ import annotations

import pytest

from crawlers.fi import FI


@pytest.fixture
def crawler() -> FI:
    c = FI()
    yield c
    c.close()


# ----- _chart_index_url -------------------------------------------------------


def test_rewrites_space_separated_section_to_chart_page(crawler: FI):
    url = "https://www.ais.fi/eaip/x/EF-AD 2 EFHK - HELSINKI 15-en-GB.html"
    out = crawler._chart_index_url(url)
    assert out.endswith(" 1-fi-FI.html")
    assert "15-en-GB" not in out


def test_rewrites_percent20_encoded_section(crawler: FI):
    url = "https://www.ais.fi/eaip/x/EF-AD%202%20EFHK%2015-en-GB.html"
    out = crawler._chart_index_url(url)
    assert out.endswith("%201-fi-FI.html")


def test_url_without_section_pattern_is_unchanged(crawler: FI):
    url = "https://www.ais.fi/eaip/currently_effective/index.html"
    assert crawler._chart_index_url(url) == url


# ----- _names_from_nav --------------------------------------------------------


def test_names_read_from_menu_anchor_ids(crawler: FI):
    nav = """
    <a id="AD 2 EFHK - HELSINKI-VANTAAen-GBplus">+</a>
    <a id="AD 3 EFMH - AHVENANMAAN KESKUSSAIRAALAen-GB">+</a>
    <a id="AD 2 EFHK - HELSINKI-VANTAAen-GB">dup</a>
    """
    names = crawler._names_from_nav(nav)
    assert names["EFHK"] == "HELSINKI-VANTAA"  # first id per ICAO wins
    assert names["EFMH"] == "AHVENANMAAN KESKUSSAIRAALA"


def test_names_from_nav_empty_when_no_matching_ids(crawler: FI):
    assert crawler._names_from_nav("<a id='not-a-field'>x</a>") == {}
