"""AD 2.3 "OPERATIONAL HOURS" row isolation (http_eurocontrol_base.ad23_hours).

Fixtures are the REAL collapsed AD 2.3 sections captured from the live LVNL
eAIP (crawler-live-test ad23_dump, run 29685082575): the aerodrome's own hours
are ROW 1 ("AD operator"), and a naive slice wrongly picked up the centrally-H24
AIS/ARO service rows (EHBD) plus a MON-TUE token from Remarks. ad23_hours must
read row 1 only.
"""

from __future__ import annotations

from crawlers.http_eurocontrol_base import (
    HttpEurocontrolBase,
    _AD2_LOCALE_RE,
    _AD2_SECTION1_RE,
    ad23_hours,
)

WIN = lambda o, c: {  # noqa: E731
    "kind": "window",
    "open": {"t": "time", "m": o},
    "close": {"t": "time", "m": c},
}


def _page(icao: str, section: str) -> str:
    return f"X {icao} AD 2.3 OPERATIONAL HOURS {section} {icao} AD 2.4 HANDLING"


# EHBD (Weert/Budel): AD operator 0600-2200; AIS/ARO are H24 (must be ignored).
EHBD = (
    " 1 AD operator 0600-2200 (0500-2100) 2 Customs and immigration "
    "0600-2200 (0500-2100) 3 Health and sanitation NIL 4 AIS briefing office "
    "H24 5 ATS reporting office (ARO) H24 6 MET briefing office NIL 7 ATS "
    "0600-2200 (0500-2100) outside UDP 8 Fuelling 0600-2200 (0500-2100) 9 "
    "Handling NIL 10 Security NIL 11 De-icing NIL 12 Remarks AD operator "
    "VFR-flights: MON-TUE: UDP BTN 0800-1630 (0700-1530); WED-SUN: UDP BTN "
    "0800-1900 (0700-1800); other times O/R. "
)
# EHAM (Schiphol): every row H24.
EHAM = (
    " 1 AD operator H24 2 Customs and immigration H24 3 Health and sanitation "
    "H24 4 AIS briefing office H24 5 ATS reporting office (ARO) H24 6 MET "
    "briefing office H24 7 ATS H24 8 Fuelling H24 9 Handling H24 "
)


# LFXX (SIA/FR): native-language page - the AD 2.3 heading is translated
# ("HEURES DE FONCTIONNEMENT"), row-1 label French ("Gestionnaire de l'AD"),
# row 2 "Douanes et police". SIA publishes no -en-GB variant, so the parser must
# read the French page directly. The " 2 " marker isolates row 1; the AIS/ARO
# H24 (rows 4/5) must be ignored.
LFXX_FR = (
    "1 Gestionnaire de l'AD 0700-1900 2 Douanes et police 0700-1900 "
    "3 Services de santé NIL 4 Bureau AIS H24 5 Bureau de piste (ARO) H24 "
)


def test_reads_row1_not_service_rows():
    hrs = ad23_hours(_page("EHBD", EHBD))
    assert hrs == [WIN(360, 1320)] * 7  # 06:00-22:00, not the AIS/ARO H24


def test_french_native_page_reads_row1():
    # Heading is French ("HEURES DE FONCTIONNEMENT"), not "OPERATIONAL HOURS".
    page = (
        "X LFXX AD 2.3 HEURES DE FONCTIONNEMENT " + LFXX_FR + " LFXX AD 2.4 SERVICE"
    )
    assert ad23_hours(page) == [WIN(420, 1140)] * 7  # 07:00-19:00, not AIS/ARO H24


def test_table_of_contents_entry_skipped():
    # A TOC "AD 2.3 ... AD 2.4" with no hours precedes the real section; the
    # finditer walk must skip the empty TOC block and read the real one.
    page = (
        "TOC AD 2.3 OPERATIONAL HOURS AD 2.4 HANDLING "  # TOC: no hours -> skip
        "X EHAM AD 2.3 OPERATIONAL HOURS " + EHAM + " EHAM AD 2.4 HANDLING"
    )
    assert ad23_hours(page) == [{"kind": "h24"}] * 7


def test_h24_aerodrome():
    assert ad23_hours(_page("EHAM", EHAM)) == [{"kind": "h24"}] * 7


def test_missing_section_is_none():
    assert ad23_hours("no AD 2.3 here at all") is None


def test_unisolatable_row1_is_none():
    # No row-2 marker / service label to bound row 1 -> do not assert.
    assert ad23_hours("X LZ AD 2.3 OPERATIONAL HOURS 1 AD admin H24 LZ AD 2.4") is None


def test_row2_number_marker_keeps_labels_after_values_safe():
    # FI-style bilingual, LABEL-AFTER-VALUE layout: row 1 is "1 <native> <hrs>
    # <english label>", row 2 "2 CUST,IMG H24 ... Customs and immigration". The
    # row-2 NUMBER marker isolates row 1 so row 2's H24 is NOT read as the
    # aerodrome's hours - the field stays unknown, never a false H24.
    fi = (
        "X EFHK AD 2.3 OPERATIONAL HOURS 1 Lentopaikan pitäjä HO Aerodrome "
        "operator 2 CUST, IMG H24 Customs and immigration 3 Terveystarkastus "
        "H24 Health and sanitation EFHK AD 2.4 HANDLING"
    )
    hrs = ad23_hours(fi)
    assert hrs is not None
    assert all(d == {"kind": "unknown"} for d in hrs)  # HO -> unknown, no H24


def test_locale_rewrite_to_english():
    # SIA/FR bilingual: swap the native locale suffix to English.
    assert _AD2_LOCALE_RE.sub(r"-en-GB\g<1>", "https://x/FR-AD-2.LFBA-fr-FR.html") == (
        "https://x/FR-AD-2.LFBA-en-GB.html"
    )
    # Already English -> unchanged.
    eng = "https://x/EH-AD 2 EHAM 1-en-GB.html"
    assert _AD2_LOCALE_RE.sub(r"-en-GB\g<1>", eng) == eng


def _rw(url: str) -> str:
    return _AD2_SECTION1_RE.sub(r"\g<1>1\g<2>", url)


def test_section1_rewrite_multi_vs_single_page():
    # NL-style multi-page: charts on section 14 -> general chapter on section 1.
    assert _rw("https://x/EH-AD 2 EHAM 14-en-GB.html").endswith(
        "EH-AD 2 EHAM 1-en-GB.html"
    )
    # SE-style: a field NAME sits between the ICAO and the section number.
    assert _rw("https://x/ES-AD 2 ESNX ARVIDSJAUR 9-en-GB.html").endswith(
        "ES-AD 2 ESNX ARVIDSJAUR 1-en-GB.html"
    )
    # SK-style single-page: no " <N>-<locale>" shape -> unchanged (url has AD 2.3).
    sk = "https://x/LZ-AD-2.LZIB-en-SK.html"
    assert _rw(sk) == sk


class _Dummy(HttpEurocontrolBase):
    def crawl(self):  # abstract-ish; unused in these tests
        return []


def test_ad2_text_fetch_and_hours_and_fails_soft():
    d = _Dummy("XX")
    page = _page("EHAM", EHAM)

    def fake_fetch(url, **_kw):
        if url == "ok":
            return page
        raise RuntimeError("boom")

    d.fetch = fake_fetch  # reuse the crawler client via self.fetch
    text = d._ad2_text("ok")
    assert text is not None and ad23_hours(text) == [{"kind": "h24"}] * 7
    assert d._ad2_text("missing") is None  # fail-soft on fetch error
    d.close()
