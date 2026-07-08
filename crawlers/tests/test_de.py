"""Unit tests for the Germany crawler (DFS BasicVFR / BasicIFR).

DE is a folder-link tree rather than a eurocontrol frameset, so it has its
own parsing helpers. We cover:

  - folder-link href collection;
  - VFR group parsing (title span + trailing 4-letter ICAO), storing the
    amendment-stable `myPermalink` read from each leaf page;
  - IFR leaf parsing (city + ICAO), storing the leaf's `myPermalink`;
  - the section-index navigation off the *static* URLs, including the
    header-link skip counts and, crucially, the type mapping (VFR
    aerodromes → vfr, VFR heliports → heliport, IFR aerodromes → ifr, IFR
    heliports → heliport) that mirrors the published Germany list and must
    not change.
"""

from __future__ import annotations

import pytest

from crawlers.de import (
    DE,
    IFR_AERODROMES_URL,
    IFR_HELIPORTS_URL,
    VFR_AERODROMES_URL,
    VFR_HELIPORTS_URL,
)


@pytest.fixture
def de() -> DE:
    crawler = DE()
    yield crawler
    crawler.close()


def _patch_pages(de: DE, pages: dict[str, str]) -> None:
    """Route `fetch` through an in-memory url -> html map."""
    de.fetch = lambda url, **kwargs: pages[url]  # type: ignore[method-assign]


def _folder(href: str, span_text: str) -> str:
    return f"<a class='folder-link' href='{href}'><span>{span_text}</span></a>"


def _permalink(page: str) -> str:
    return f'<script>const myPermalink = "{page}";</script>'


def _leaf(city: str, icao: str, permalink: str | None = None) -> str:
    perm = _permalink(permalink) if permalink else ""
    return (
        f"{perm}"
        f"<div class='headlineText left'><span>{city}</span></div>"
        f"<a class='document-link'><span class='document-name'>{icao} AD</span></a>"
    )


# ----- folder-link collection -------------------------------------------------


def test_folder_link_hrefs_in_order_skipping_missing(de: DE):
    html = """
      <a class='folder-link' href='a.html'>A</a>
      <a class='folder-link'>no href</a>
      <a class='folder-link' href='b.html'>B</a>
      <a class='other' href='c.html'>not a folder link</a>
    """
    assert de.folder_link_hrefs(html) == ["a.html", "b.html"]


# ----- VFR group parsing ------------------------------------------------------


def test_vfr_group_stores_permalink_from_leaf(de: DE):
    group_url = "https://aip.dfs.de/BasicVFR/pages/grpE.html"
    pages = {
        group_url: _folder("C019CA.html", "STUTTGART EDDS")
        + _folder("C012AB.html", "FRANKFURT EDDF"),
        "https://aip.dfs.de/BasicVFR/pages/C019CA.html": _permalink("pages/C019CA.html"),
        "https://aip.dfs.de/BasicVFR/pages/C012AB.html": _permalink("pages/C012AB.html"),
    }
    _patch_pages(de, pages)
    airports: list = []
    de._extract_vfr_group(group_url, "vfr", airports)
    assert [(a.icao, a.title, a.airport_type, a.url) for a in airports] == [
        ("EDDS", "STUTTGART EDDS", "vfr", "https://aip.dfs.de/BasicVFR/pages/C019CA.html"),
        ("EDDF", "FRANKFURT EDDF", "vfr", "https://aip.dfs.de/BasicVFR/pages/C012AB.html"),
    ]


def test_vfr_permalink_resolves_against_fork_root_not_leaf(de: DE):
    # The physical leaf lives under an edition folder, but myPermalink is
    # relative to the BasicVFR root — it must resolve there, not under the
    # edition path.
    group_url = "https://aip.dfs.de/BasicVFR/2026JUN25/chapter/group.html"
    leaf_url = "https://aip.dfs.de/BasicVFR/2026JUN25/chapter/edny.html"
    pages = {
        group_url: _folder("edny.html", "FRIEDRICHSHAFEN EDNY"),
        leaf_url: _permalink("pages/C019CA.html"),
    }
    _patch_pages(de, pages)
    airports: list = []
    de._extract_vfr_group(group_url, "vfr", airports)
    assert airports[0].url == "https://aip.dfs.de/BasicVFR/pages/C019CA.html"


def test_vfr_group_falls_back_to_href_when_permalink_fetch_fails(de: DE):
    group_url = "https://aip.dfs.de/BasicVFR/pages/grpX.html"
    # Leaf page is not in the map -> KeyError on fetch -> fallback to href.
    _patch_pages(de, {group_url: _folder("EDNY.html", "FRIEDRICHSHAFEN EDNY")})
    airports: list = []
    de._extract_vfr_group(group_url, "vfr", airports)
    assert airports[0].url == "https://aip.dfs.de/BasicVFR/pages/EDNY.html"


def test_vfr_group_title_without_icao_yields_none(de: DE):
    group_url = "https://aip.dfs.de/BasicVFR/pages/hel.html"
    pages = {
        group_url: _folder("x.html", "Some Heliport"),
        "https://aip.dfs.de/BasicVFR/pages/x.html": _permalink("pages/C0AAAA.html"),
    }
    _patch_pages(de, pages)
    airports: list = []
    de._extract_vfr_group(group_url, "heliport", airports)
    assert len(airports) == 1
    assert airports[0].icao is None
    assert airports[0].airport_type == "heliport"


def test_vfr_group_skips_links_without_href_or_title(de: DE):
    group_url = "https://aip.dfs.de/BasicVFR/pages/grpX.html"
    html = (
        "<a class='folder-link'><span>no href</span></a>"
        "<a class='folder-link' href='empty.html'><span></span></a>"
        + _folder("EDNY.html", "FRIEDRICHSHAFEN EDNY")
    )
    pages = {
        group_url: html,
        "https://aip.dfs.de/BasicVFR/pages/empty.html": "",
        "https://aip.dfs.de/BasicVFR/pages/EDNY.html": _permalink("pages/C019CA.html"),
    }
    _patch_pages(de, pages)
    airports: list = []
    de._extract_vfr_group(group_url, "vfr", airports)
    assert [a.icao for a in airports] == ["EDNY"]


def test_vfr_group_fetch_failure_is_swallowed(de: DE):
    def boom(url, **kwargs):
        raise RuntimeError("network down")

    de.fetch = boom  # type: ignore[method-assign]
    airports: list = []
    de._extract_vfr_group("https://aip.dfs.de/BasicVFR/pages/grpE.html", "vfr", airports)
    assert airports == []  # error logged, not raised


# ----- IFR leaf parsing -------------------------------------------------------


def test_ifr_leaf_extracts_city_icao_and_permalink(de: DE):
    leaf_url = "https://aip.dfs.de/BasicIFR/2026JUN25/chapter/edds.html"
    _patch_pages(de, {leaf_url: _leaf("Stuttgart", "EDDS", "pages/C0BEEF.html")})
    airports: list = []
    de._extract_ifr_leaf(leaf_url, "ifr", airports)
    [airport] = airports
    assert airport.icao == "EDDS"
    assert airport.title == "Stuttgart EDDS"
    assert airport.url == "https://aip.dfs.de/BasicIFR/pages/C0BEEF.html"
    assert airport.airport_type == "ifr"


def test_ifr_leaf_without_permalink_keeps_fetched_url(de: DE):
    leaf_url = "https://aip.dfs.de/BasicIFR/pages/EDDS.html"
    _patch_pages(de, {leaf_url: _leaf("Stuttgart", "EDDS")})
    airports: list = []
    de._extract_ifr_leaf(leaf_url, "ifr", airports)
    assert airports[0].url == leaf_url


def test_ifr_leaf_without_city_or_icao_is_skipped(de: DE):
    leaf_url = "https://aip.dfs.de/BasicIFR/pages/empty.html"
    _patch_pages(de, {leaf_url: "<html><body>nothing useful</body></html>"})
    airports: list = []
    de._extract_ifr_leaf(leaf_url, "ifr", airports)
    assert airports == []


def test_ifr_leaf_city_only_still_recorded(de: DE):
    leaf_url = "https://aip.dfs.de/BasicIFR/pages/city-only.html"
    html = "<div class='headlineText left'><span>Egelsbach</span></div>"
    _patch_pages(de, {leaf_url: html})
    airports: list = []
    de._extract_ifr_leaf(leaf_url, "ifr", airports)
    [airport] = airports
    assert airport.icao is None
    assert airport.title == "Egelsbach"


# ----- section navigation off the static URLs + type mapping ------------------


def test_process_vfr_skips_headers_and_maps_types(de: DE):
    # AD index: 3 header links to skip + 2 real group links.
    ad_index = (
        _folder("C0.html", "AD 0 Content")
        + _folder("C1.html", "AD 1 General Remarks")
        + _folder("C2.html", "AD 2 List")
        + _folder("grpE.html", "E")
        + _folder("grpL.html", "L")
    )
    # HEL index: 1 header link to skip + 1 real group link.
    hel_index = _folder("C3.html", "HEL AD 3 List") + _folder("grpH.html", "H")

    base = "https://aip.dfs.de/BasicVFR/pages/"
    pages = {
        VFR_AERODROMES_URL: ad_index,
        VFR_HELIPORTS_URL: hel_index,
        base + "grpE.html": _folder("EDDS.html", "STUTTGART EDDS"),
        base + "grpL.html": _folder("EDDL.html", "DUESSELDORF EDDL"),
        base + "grpH.html": _folder("EDXH.html", "HELGOLAND EDXH"),
        base + "EDDS.html": _permalink("pages/EDDS.html"),
        base + "EDDL.html": _permalink("pages/EDDL.html"),
        base + "EDXH.html": _permalink("pages/EDXH.html"),
    }
    _patch_pages(de, pages)

    airports: list = []
    de._process_vfr(airports)

    by_icao = {a.icao: a.airport_type for a in airports}
    # Header links were skipped: only real airfields remain.
    assert by_icao == {"EDDS": "vfr", "EDDL": "vfr", "EDXH": "heliport"}


def test_process_ifr_dedups_and_maps_types(de: DE):
    # AD 2 index links straight to leaves; include a duplicate to prove dedup.
    ad2_index = (
        _folder("EDDS.html", "x")
        + _folder("EDDF.html", "x")
        + _folder("EDDS.html", "x")  # duplicate
    )
    ad3_index = _folder("EDXH.html", "x")

    vbase = "https://aip.dfs.de/BasicIFR/pages/"
    pages = {
        IFR_AERODROMES_URL: ad2_index,
        IFR_HELIPORTS_URL: ad3_index,
        vbase + "EDDS.html": _leaf("Stuttgart", "EDDS", "pages/EDDS.html"),
        vbase + "EDDF.html": _leaf("Frankfurt", "EDDF", "pages/EDDF.html"),
        vbase + "EDXH.html": _leaf("Helgoland", "EDXH", "pages/EDXH.html"),
    }
    _patch_pages(de, pages)

    airports: list = []
    de._process_ifr(airports)

    pairs = sorted((a.icao, a.airport_type) for a in airports)
    # EDDS appeared twice in the index but is crawled once; types mapped.
    assert pairs == [("EDDF", "ifr"), ("EDDS", "ifr"), ("EDXH", "heliport")]
