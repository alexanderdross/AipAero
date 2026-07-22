"""Unit tests for the Estonia crawler's candidate-id section fallback."""

from __future__ import annotations

import pytest

from crawlers.ee import EE, _AD2_SECTION_IDS

# The base extract_airports_from_html matches a section id by suffix, so the id
# just has to END with a candidate. First menu uses the primary candidate, the
# second uses the hyphenated fallback.
_PAIR = """
  <div><a href="ad/EETN.html">EETN TALLINN</a></div>
  <div><div><a href="charts/EETN.pdf" title="Charts related to an Aerodrome">c</a></div></div>
"""
NAV_PRIMARY = f'<div id="menu-AD 2en-GBdetails">{_PAIR}</div>'
NAV_FALLBACK = f'<div id="menu-AD-2details">{_PAIR}</div>'


@pytest.fixture
def crawler() -> EE:
    c = EE()
    yield c
    c.close()


def test_extract_section_matches_first_candidate(crawler: EE):
    airports = crawler._extract_section(
        NAV_PRIMARY, "https://eaip.eans.ee/x/nav.html", _AD2_SECTION_IDS, "vfr"
    )
    assert [a.icao for a in airports] == ["EETN"]
    assert airports[0].airport_type == "vfr"
    assert airports[0].title.endswith("EETN")


def test_extract_section_falls_back_to_later_candidate(crawler: EE):
    # The primary id "AD 2en-GBdetails" is absent; the loop must try the
    # hyphenated "AD-2details" candidate and succeed.
    airports = crawler._extract_section(
        NAV_FALLBACK, "https://eaip.eans.ee/x/nav.html", _AD2_SECTION_IDS, "vfr"
    )
    assert [a.icao for a in airports] == ["EETN"]


def test_extract_section_all_candidates_miss_raises(crawler: EE):
    with pytest.raises(ValueError):
        crawler._extract_section(
            "<div>nothing</div>", "u", _AD2_SECTION_IDS, "vfr"
        )
