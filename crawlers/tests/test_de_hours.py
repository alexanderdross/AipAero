"""Tests for the DE AD 2.3 OCR-hours pre-processor (crawlers.de_hours), using
REAL OCR output shapes captured live (crawler-live-test) from DFS BasicVFR."""

from crawlers.de_hours import parse_de_hours

# EDNY - the live OCR of the AD 2.3 operator row (with its real garble): dual
# summer/winter times "0500 (0400)", a comma day-list "Sat, Sun, HOL", and an
# "SS+030 MAX 1900" solar tail.
EDNY_OCR = (
    "LUFTFAHRTHANDBUCH DEUTSCHLAND AD 2 EDNY 1-1 EDNY AD 2.3 Operational hours "
    "1] AD operator Mon - Fri 0500 (0400) - 2100 (2000), Sat, Sun, HOL 0800 "
    "(0700) - SS+030 MAX 1900 (1800) Other times: PPR on preceding workday 1100 "
    "2] Customs and immigration Mon - Fri 0500 (0400) - 2100 (2000) "
    "AD 2.4 Handling services and facilities"
)


def test_edny_weekday_window_parsed():
    hours = parse_de_hours(EDNY_OCR)
    assert hours is not None and len(hours) == 7
    # Mon-Fri 0500-2100 (UTC minutes 300..1260).
    for i in range(5):
        assert hours[i] == {
            "kind": "window",
            "open": {"t": "time", "m": 300},
            "close": {"t": "time", "m": 1260},
        }


def test_edny_weekend_solar_window_parsed():
    hours = parse_de_hours(EDNY_OCR)
    assert hours is not None
    # Sat + Sun 0800-SS (the "+030 MAX 1900" tail is dropped to bare SS).
    for i in (5, 6):
        assert hours[i] == {
            "kind": "window",
            "open": {"t": "time", "m": 480},
            "close": {"t": "ss"},
        }


def test_h24_operator():
    hours = parse_de_hours(
        "X AD 2.3 Operational hours 1] AD operator H24 2] Customs H24 AD 2.4"
    )
    assert hours == [{"kind": "h24"}] * 7


def test_monfri_only_leaves_weekend_unknown():
    hours = parse_de_hours(
        "X AD 2.3 Operational hours 1] AD operator MON-FRI 0800-1700 2] AD 2.4"
    )
    assert hours is not None
    assert hours[0]["kind"] == "window"
    assert hours[5] == {"kind": "unknown"} and hours[6] == {"kind": "unknown"}


def test_no_ad23_region_returns_none():
    # A chart page's OCR (no AD 2.3 section) -> no hours.
    assert parse_de_hours("AD 2 EDXX 2-1 Aerodrome Chart nothing here") is None


def test_empty_and_non_string_return_none():
    assert parse_de_hours("") is None
    assert parse_de_hours(None) is None
    assert parse_de_hours(123) is None
