"""Unit tests for the Lithuania crawler's VFR-manual merge (issue #35).

The LT eAIP (4 international aerodromes) is covered by the live flow; here we
cover the separate open "AIP VFR LITHUANIA" PDF tree in isolation with a mocked
`fetch`: newest-edition resolution, GEN/ENR front-matter filtering, place-name
titles (no ICAO), and grouping a field's extra sheet as a second chart.
"""

from __future__ import annotations

import pytest

from crawlers.lt import LT, VFR_ROOT_URL


@pytest.fixture
def lt() -> LT:
    return LT()


# An Apache-style index of dated editions (newest must win).
_ROOT_INDEX = """
<html><body>
<a href="?C=N;O=D">Name</a>
<a href="/a1/">Parent Directory</a>
<a href="aip_vfr_79_16apr2026/">aip_vfr_79_16apr2026/</a>
<a href="aip_vfr_11jun2026/">aip_vfr_11jun2026/</a>
</body></html>
"""

# The current edition's landing page: field PDFs + GEN/ENR front matter.
_EDITION_INDEX = """
<html><head><title>AIP VFR LITHUANIA</title></head><body>
<a href="pdf/amdt.pdf">Amendments</a>
<a href="pdf/gen0-1.pdf">GEN 0-1</a>
<a href="pdf/enr1-1.pdf">ENR 1-1</a>
<a href="pdf/VFR_GRID_ENR1.1_9.pdf">Grid</a>
<a href="pdf/klaipeda.pdf">Klaipeda</a>
<a href="pdf/nida.pdf">Nida</a>
<a href="pdf/paluknys.pdf">Paluknys</a>
<a href="pdf/paluknys_av.pdf">Paluknys AV</a>
<a href="https://www.ans.lt/en/information-publications/aip-aip-supplements">Supplements</a>
</body></html>
"""


def test_resolve_vfr_edition_picks_newest(lt: LT):
    lt.fetch = lambda url, **kw: _ROOT_INDEX  # type: ignore[method-assign]
    base = lt._resolve_vfr_edition()
    assert base == VFR_ROOT_URL + "aip_vfr_11jun2026/"


def test_crawl_vfr_manual_filters_frontmatter_and_groups_sheets(lt: LT):
    pages = {
        VFR_ROOT_URL: _ROOT_INDEX,
        VFR_ROOT_URL + "aip_vfr_11jun2026/": _EDITION_INDEX,
    }
    lt.fetch = lambda url, **kw: pages[url]  # type: ignore[method-assign]

    fields = lt._crawl_vfr_manual()
    titles = [a.title for a in fields]
    # GEN/ENR/AMDT front matter dropped; only the 3 place-name fields remain.
    assert titles == ["Klaipeda", "Nida", "Paluknys"]
    # Name-only (no ICAO), the PDF is both url and pdf_url, type vfr.
    klaipeda = fields[0]
    assert klaipeda.icao is None
    assert klaipeda.airport_type == "vfr"
    assert klaipeda.url.endswith("/aip_vfr_11jun2026/pdf/klaipeda.pdf")
    assert klaipeda.pdf_url == klaipeda.url
    # paluknys + paluknys_av collapse into ONE field with two charts; the plain
    # "VFR" sheet is the primary pdf_url.
    paluknys = fields[2]
    assert {c.name for c in paluknys.charts} == {"VFR", "AV"}
    assert paluknys.pdf_url.endswith("/pdf/paluknys.pdf")


def test_crawl_vfr_manual_failsoft_on_no_edition(lt: LT):
    lt.fetch = lambda url, **kw: "<html><body>nothing here</body></html>"  # type: ignore[method-assign]
    assert lt._crawl_vfr_manual() == []
