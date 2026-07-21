"""Unit tests for the DK Naviair data-sheet operating-hours pre-processor.

Fixtures mirror the real ``EK_AD_2_<ICAO>_en.pdf`` text layer (the "01. AD 2
<ICAO> text" document), captured from the live crawler-live-test recon:
Naviair's flat "4. Operational hours" layout, bilingual, with the aerodrome's
own window on the ``AD:`` row (not the APP/TWR/ARO/AIS/MET service rows).
"""

from __future__ import annotations

from crawlers.dk_hours import parse_dk_hours

# EKKA (Karup): AD row carries a PPR note + a two-part MON-FRI window / SAT-SUN
# closed, plus the parenthetical summer shift that must be dropped to the base.
_EKKA = (
    "VFR Flight Guide Denmark AD 2. EKKA - 1 NAVIAIR "
    "1. Location 10 NM NNE of Herning 2. Address MIL: Karup Air Base "
    "3. Approved for VMC day and VFR night operations "
    "4. Operational hours APP: H24 (H24) TWR: H24 (H24) "
    "AD: PPR, see item 16 a. MON-FRI 0500-1700 (0400-1600) SAT-SUN CLSD "
    "ADO: As AD ARO: H24 AIS: As ADO MET: H24 TEL: +45 72 84 14 41 "
    "5. Customs/Immigration The airport is open for traffic to/from all States. "
    "1. Beliggenhed 10 NM NNE for Herning 4. Tjenestetider AD: MON-FRI 0500-1700"
)

# EKBI (Billund): every service, incl. AD, is H24.
_EKBI = (
    "VFR Flight Guide Denmark AD 2. EKBI - 1 NAVIAIR 1. Location 1 NM NE of "
    "Billund 3. Approved for VMC day and VFR night operations "
    "4. Operational hours APP: H24 TWR: H24 AD: H24 ADO: H24 ARO: H24 AIS: H24 "
    "MET: H24 Rescue and Fire Fighting Services: See item 9 "
    "5. Customs/Immigration: The airport is open for traffic to/from all States."
)

# EKAT (Anholt): a small field open sunrise-to-sunset every day.
_EKAT = (
    "VFR Flight Guide Denmark AD 2. EKAT - 1 NAVIAIR 1. Location 0.3 NM ESE of "
    "Anholt town. 3. Approved for a. VMC day operations b. Self-service only "
    "4. Operational hours AD: Daily SR-SS (Daily SR-SS) ARO: Submission of "
    "flight plan: Briefing EKCH TEL: +45 32 47 82 72 MET: TEL: +45 39 15 72 72 "
    "5. Customs/Immigration The aerodrome is open for traffic to/from Schengen."
)


def test_ekka_window_and_closed_weekend():
    hrs = parse_dk_hours(_EKKA)
    assert hrs is not None
    # MON-FRI 0500-1700Z (base/winter value; the (0400-1600) summer bracket is
    # dropped), SAT-SUN closed. Index 0 = Monday.
    for i in range(5):
        assert hrs[i] == {
            "kind": "window",
            "open": {"t": "time", "m": 300},
            "close": {"t": "time", "m": 1020},
        }, i
    assert hrs[5] == {"kind": "closed"}
    assert hrs[6] == {"kind": "closed"}


def test_ekbi_all_h24():
    hrs = parse_dk_hours(_EKBI)
    assert hrs == [{"kind": "h24"} for _ in range(7)]


def test_ekat_daily_solar_window():
    hrs = parse_dk_hours(_EKAT)
    assert hrs == [
        {"kind": "window", "open": {"t": "sr"}, "close": {"t": "ss"}}
        for _ in range(7)
    ]


def test_ad_row_wins_over_service_rows():
    # The AD row must be isolated from the H24 APP/TWR/ARO service rows around
    # it: EKKA's aerodrome window is MON-FRI 0500-1700, not H24.
    hrs = parse_dk_hours(_EKKA)
    assert hrs is not None
    assert {d["kind"] for d in hrs} == {"window", "closed"}
    assert all(d.get("kind") != "h24" for d in hrs)


def test_failsoft_no_item4():
    assert parse_dk_hours("1. Location somewhere 2. Address foo bar") is None


def test_failsoft_ppr_only_ad_row_is_none():
    # An AD row with only a PPR note (no window / H24 / CLSD) asserts nothing.
    text = (
        "4. Operational hours AD: PPR, O/R via briefing ARO: H24 "
        "5. Customs/Immigration ..."
    )
    assert parse_dk_hours(text) is None


def test_non_string_is_none():
    assert parse_dk_hours(None) is None
    assert parse_dk_hours(b"bytes") is None
