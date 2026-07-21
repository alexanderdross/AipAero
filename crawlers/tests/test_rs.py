"""Unit tests for the Serbia (SMATSA VFR AIP) crawler.

RS headless-renders a JS-built AD page, groups every per-aerodrome PDF by its
KEY (ICAO or field name), and emits one VFR Airport per aerodrome. We test the
grouping/primary-chart selection and the AD 2.3 operating-hours extraction by
monkeypatching ``render_html`` (the browser) and ``pdf_text`` (the data sheet),
so the tests run browserless.
"""

from __future__ import annotations

import pytest

from crawlers.rs import RS

# The AD page after JS render: LYBE (coded, full name mapped) with a VAC, an ADC
# and the section-less aerodrome-DATA sheet, plus an uncoded field (BLACE) with a
# single chart and no ICAO.
_AD_HTML = """<html><body>
  <a href="../pdf/adr/VFR_LY_AD_2_LYBE_2-4-1_en.pdf">Visual Operation Chart</a>
  <a href="../pdf/adr/VFR_LY_AD_2_LYBE_2-1-1_en.pdf">Aerodrome Chart</a>
  <a href="../pdf/adr/VFR_LY_AD_2_LYBE_en.pdf">Podaci o aerodromu</a>
  <a href="../pdf/adr/VFR_LY_AD_2_BLACE_en.pdf">BLACE</a>
</body></html>"""

_LYBE_DATA_TEXT = (
    "LYBE AD 2.3 OPERATIONAL HOURS "
    "1 Aerodrome operator MON-FRI 0700-1700 "
    "2 Customs and immigration H24 "
    "AD 2.4 HANDLING SERVICES AND FACILITIES"
)

_WINDOW_0700_1700 = {
    "kind": "window",
    "open": {"t": "time", "m": 7 * 60},
    "close": {"t": "time", "m": 17 * 60},
}
_UNKNOWN = {"kind": "unknown"}


@pytest.fixture
def rs(monkeypatch) -> RS:
    crawler = RS()
    monkeypatch.setattr(
        crawler, "render_html", lambda url, **kw: _AD_HTML
    )
    yield crawler
    # crawl() already closes; closing twice is safe.
    crawler.close()


def test_groups_aerodromes_and_titles(rs: RS, monkeypatch):
    monkeypatch.setattr(rs, "pdf_text", lambda url: "")
    airports = rs.crawl()
    by_key = {a.icao or a.title: a for a in airports}
    assert "LYBE" in {a.icao for a in airports}
    lybe = next(a for a in airports if a.icao == "LYBE")
    assert lybe.title == "Beograd Nikola Tesla LYBE"
    # VAC (2-4-1) is the primary chart, ahead of the ADC and the data sheet.
    assert lybe.url.endswith("VFR_LY_AD_2_LYBE_2-4-1_en.pdf")
    # The uncoded field lists with no ICAO.
    blace = next(a for a in airports if a.title == "Blace")
    assert blace.icao is None


def test_ad23_hours_from_data_sheet(rs: RS, monkeypatch):
    def fake_pdf_text(url: str) -> str:
        return _LYBE_DATA_TEXT if url.endswith("VFR_LY_AD_2_LYBE_en.pdf") else ""

    monkeypatch.setattr(rs, "pdf_text", fake_pdf_text)
    rs.crawl()
    assert rs.hours_by_icao["LYBE"] == [_WINDOW_0700_1700] * 5 + [_UNKNOWN] * 2


def test_ad23_hours_soft_when_pdf_text_raises(rs: RS, monkeypatch):
    def boom(url: str) -> str:
        raise ValueError("pdf parse failed")

    monkeypatch.setattr(rs, "pdf_text", boom)
    airports = rs.crawl()
    assert "LYBE" in {a.icao for a in airports}
    assert "LYBE" not in rs.hours_by_icao
