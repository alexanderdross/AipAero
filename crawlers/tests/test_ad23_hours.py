"""AD 2.3 "OPERATIONAL HOURS" row isolation (http_eurocontrol_base.ad23_hours).

Fixtures are the REAL collapsed AD 2.3 sections captured from the live LVNL
eAIP (crawler-live-test ad23_dump, run 29685082575): the aerodrome's own hours
are ROW 1 ("AD operator"), and a naive slice wrongly picked up the centrally-H24
AIS/ARO service rows (EHBD) plus a MON-TUE token from Remarks. ad23_hours must
read row 1 only.
"""

from __future__ import annotations

from crawlers.http_eurocontrol_base import ad23_hours

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


def test_reads_row1_not_service_rows():
    hrs = ad23_hours(_page("EHBD", EHBD))
    assert hrs == [WIN(360, 1320)] * 7  # 06:00-22:00, not the AIS/ARO H24


def test_h24_aerodrome():
    assert ad23_hours(_page("EHAM", EHAM)) == [{"kind": "h24"}] * 7


def test_missing_section_is_none():
    assert ad23_hours("no AD 2.3 here at all") is None


def test_unisolatable_row1_is_none():
    # No service-row label to bound row 1 -> do not assert (conservative).
    assert ad23_hours("X LZ AD 2.3 OPERATIONAL HOURS 1 AD admin H24 LZ AD 2.4") is None
