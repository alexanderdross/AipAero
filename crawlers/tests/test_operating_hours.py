"""Unit tests for the structured operation-hours normalizer.

Mirrors the TypeScript vectors in src/lib/opening-hours.test.ts so the two
sides (OpenAIP backfill / eAIP AD 2.3 crawler <-> website) agree on the shape.
"""

from __future__ import annotations

from crawlers.operating_hours import (
    guard_ocr_hours,
    parse_ad23_text,
    parse_openaip_hours,
    to_json,
)

WIN = lambda o, c: {"kind": "window", "open": o, "close": c}  # noqa: E731
T = lambda m: {"t": "time", "m": m}  # noqa: E731


def test_openaip_monfri_fixed_with_solar_weekend():
    raw = {
        "operatingHours": [
            {"dayOfWeek": 0, "startTime": "08:00", "endTime": "20:00"},
            {"dayOfWeek": 1, "startTime": "08:00", "endTime": "20:00"},
            {"dayOfWeek": 4, "startTime": "08:00", "endTime": "20:00"},
            {"dayOfWeek": 5, "sunrise": True, "sunset": True},
        ]
    }
    s = parse_openaip_hours(raw)
    assert s is not None and len(s) == 7
    assert s[0] == WIN(T(480), T(1200))
    assert s[5] == WIN({"t": "sr"}, {"t": "ss"})
    # Day not mentioned -> unknown (never "closed" from silence).
    assert s[2] == {"kind": "unknown"}
    assert s[6] == {"kind": "unknown"}


def test_openaip_notam_and_none():
    s = parse_openaip_hours({"operatingHours": [{"dayOfWeek": 0, "byNotam": True}]})
    assert s[0] == {"kind": "notam"}
    assert parse_openaip_hours({"remarks": "see AIP"}) is None
    assert parse_openaip_hours(None) is None


def test_ad23_h24():
    assert parse_ad23_text("H24") == [{"kind": "h24"}] * 7


def test_ad23_notam():
    assert parse_ad23_text("Available by NOTAM") == [{"kind": "notam"}] * 7


def test_ad23_day_range_window():
    s = parse_ad23_text("MON-FRI 0800-1700")
    assert s[0] == WIN(T(480), T(1020))
    assert s[4] == WIN(T(480), T(1020))
    assert s[5] == {"kind": "unknown"}
    assert s[6] == {"kind": "unknown"}


def test_ad23_multiple_segments_and_solar():
    s = parse_ad23_text("MON-FRI 0800-1700; SAT 0900-SS")
    assert s[0] == WIN(T(480), T(1020))
    assert s[5] == WIN(T(540), {"t": "ss"})
    assert s[6] == {"kind": "unknown"}


def test_ad23_daily():
    s = parse_ad23_text("DAILY 0600-2200")
    assert all(d == WIN(T(360), T(1320)) for d in s)


def test_ad23_window_without_day_prefix_applies_all_week():
    s = parse_ad23_text("0700-1900")
    assert all(d == WIN(T(420), T(1140)) for d in s)


def test_ad23_on_request_is_unknown_not_guessed():
    assert parse_ad23_text("O/R") is None or parse_ad23_text("O/R") == [
        {"kind": "unknown"}
    ] * 7
    # A day range that is only O/R -> that day is unknown, not open.
    s = parse_ad23_text("MON-FRI O/R")
    assert s[0] == {"kind": "unknown"}


def test_ad23_empty_and_garbage():
    assert parse_ad23_text("") is None
    assert parse_ad23_text(None) is None
    assert parse_ad23_text("no hours here") is None


def test_to_json_roundtrip():
    s = parse_ad23_text("MON-FRI 0800-1700")
    js = to_json(s)
    assert js is not None and '"kind":"window"' in js
    assert to_json(None) is None


# ---- guard_ocr_hours (OCR plausibility backstop) -----------------------------

SS = {"t": "ss"}  # solar close boundary


def test_guard_drops_implausibly_short_window():
    # Day 0 is a 10-min window (dropped); day 1 is plausible (kept) so the whole
    # set is not emptied to None.
    hrs = [WIN(T(600), T(610)), WIN(T(480), T(1200))] + [
        {"kind": "unknown"} for _ in range(5)
    ]
    guarded = guard_ocr_hours(hrs)
    assert guarded[0] == {"kind": "unknown"}  # short window dropped
    assert guarded[1] == WIN(T(480), T(1200))  # plausible survives


def test_guard_drops_near_24h_window_all_days_then_none():
    hrs = [WIN(T(0), T(1439)) for _ in range(7)]  # ~24h but not H24 -> unknown
    assert guard_ocr_hours(hrs) is None  # every day emptied -> no false badge


def test_guard_keeps_plausible_and_solar_windows():
    hrs = [WIN(T(480), T(1200))] + [WIN(T(480), SS) for _ in range(6)]
    guarded = guard_ocr_hours(hrs)
    assert guarded[0] == WIN(T(480), T(1200))  # plausible fixed kept
    assert guarded[1] == WIN(T(480), SS)  # solar boundary always kept


def test_guard_keeps_h24_and_closed_days():
    hrs = [{"kind": "h24"}, {"kind": "closed"}] + [{"kind": "unknown"} for _ in range(5)]
    assert guard_ocr_hours(hrs)[:2] == [{"kind": "h24"}, {"kind": "closed"}]


def test_guard_none_stays_none():
    assert guard_ocr_hours(None) is None
