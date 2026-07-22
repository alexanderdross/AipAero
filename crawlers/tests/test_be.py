"""Unit tests for the Belgium/Luxembourg crawler: category->type resolution and
per-chapter section extraction."""

from __future__ import annotations

import pytest

from crawlers.be import BE


def _chapter(part: str, icao: str, name: str) -> str:
    return (
        f'<div><a href="ad/{icao}.html">AD {part}.{icao} {name}</a></div>'
        f'<div id="menu-AD-{part}.{icao}details">'
        f'<div><a href="charts/{icao}.pdf" title="Charts related to an Aerodrome">c</a>'
        f"</div></div>"
    )


# A menu with one public IFR aerodrome, one private VFR field, one heliport -
# each under its own preceding category heading.
NAV = f"""<div id="menu">
  <div>AD 2 PUBLIC AERODROMES</div>
  {_chapter("2", "EBAW", "ANTWERPEN / Deurne")}
  <div>AD 2 PRIVATE AERODROMES</div>
  {_chapter("2", "EBTY", "Maillen")}
  <div>AD 3 HOSPITAL HELIPORTS</div>
  {_chapter("3", "EBMG", "Sint-Truiden Hospital")}
</div>"""


@pytest.fixture
def crawler() -> BE:
    c = BE()
    yield c
    c.close()


def test_category_maps_to_type_from_preceding_heading(crawler: BE):
    airports = crawler._extract_airport_sections(NAV, "https://ops.skeyes.be/nav.html")
    by_icao = {a.icao: a for a in airports}
    assert by_icao["EBAW"].airport_type == "ifr"  # PUBLIC AERODROMES
    assert by_icao["EBTY"].airport_type == "vfr"  # PRIVATE AERODROMES
    assert by_icao["EBMG"].airport_type == "heliport"  # HOSPITAL HELIPORTS


def test_titles_follow_name_icao_rule(crawler: BE):
    airports = crawler._extract_airport_sections(NAV, "https://ops.skeyes.be/nav.html")
    for a in airports:
        assert a.title.endswith(a.icao)
        assert a.title != a.icao


def test_category_fallback_by_ad_part(crawler: BE):
    # No category heading -> AD-2 defaults to vfr, AD-3 to heliport.
    html = f'<div id="m">{_chapter("2", "EBZZ", "Somewhere")}</div>'
    [a] = crawler._extract_airport_sections(html, "https://ops.skeyes.be/nav.html")
    assert a.airport_type == "vfr"


def test_empty_menu_raises(crawler: BE):
    with pytest.raises(ValueError):
        crawler._extract_airport_sections("<div>nothing</div>", "u")
