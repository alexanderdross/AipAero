"""DE-specific pre-processor: DFS AD 2.3 OCR text -> structured operation hours.

DFS BasicVFR serves each AD-2 book page as a PNG image; ``de.py`` OCRs those
images (``de_ocr.py``). The AD 2.3 "Operational hours" table OCRs as one messy
run of text per row ("1] AD operator MON - FRI 0500 (0400) - 2100 (2000), SAT,
SUN, HOL 0800 (0700) - SS+030 ...").  This module slices that region, takes the
aerodrome-operator row (row ``1]``) as the field's operating hours, normalises
the German-AIP / OCR quirks, and reuses the shared
``operating_hours.parse_ad23_text`` so DE lands in the SAME structured 7-day
shape as every eAIP country.

Normalised quirks:
  * summer/winter dual times ``0500 (0400)`` -> keep the first (summer, current);
  * comma day-lists ``SAT, SUN, HOL`` -> expanded to per-day segments (``HOL``
    holidays dropped - the model has no holiday concept);
  * ``SS+030`` / ``MAX 1900`` solar-offset tails -> reduced to the bare ``SS``;
  * OCR dash/equals glyphs ``-`` ``=`` -> a plain hyphen.

A plausibility guard (``_guard``) then drops any FIXED-time window that a digit
slip could have produced - degenerate / wrapped, implausibly short (< 30 min) or
near-24h-yet-not-``H24`` - to ``unknown`` before publishing, so an OCR mis-read
never asserts a confident "open" window. Solar (SR/SS) windows always pass.

Best-effort + fail-soft: returns ``None`` whenever nothing confidently parseable
is found (a field that does not parse simply shows no badge on the website).

Owner directive (20.07.2026): unlike the earlier display-only stance, the parsed
hours now drive the structured open/closed badge, the map filter and the JSON-LD
- BUT the website renders an always-visible "machine-read via OCR, times may
differ, verify against the AIP" disclaimer next to them, because the DFS OCR can
mis-read digits.
"""

from __future__ import annotations

import re

from crawlers.operating_hours import StructuredHours, parse_ad23_text

_DAYS = "MON|TUE|WED|THU|FRI|SAT|SUN"
# The AD 2.3 region: from the "AD 2.3" marker to the next AD section ("AD 2.4").
_AD23_RE = re.compile(r"AD\s*2\.?\s*3\b(.*?)(?=AD\s*2\.?\s*4\b|$)", re.S | re.I)
# The aerodrome-operator row: "1] AD operator <hours...>" up to the next "N]"
# numbered row. This row is the field's operating hours (customs / ATS / fuel
# have their own rows and are not the aerodrome's open window).
_OPERATOR_ROW_RE = re.compile(
    r"1\s*\]\s*AD\s*operator\b(.*?)(?=\d\s*\]|$)", re.S | re.I
)
# A (day-group, window) clause: some run of day tokens / commas / dashes,
# immediately followed by a "HHMM-HHMM" (or SR/SS) window.
_CLAUSE_RE = re.compile(
    rf"((?:(?:{_DAYS}|HOL|DAILY|DLY)[\s,–—=-]*)+?)"
    r"(\d{3,4}|SR|SS)\s*[-–—=]\s*(\d{3,4}|SR|SS)",
    re.I,
)
_RANGE_RE = re.compile(rf"({_DAYS})\s*[-–—=]\s*({_DAYS})", re.I)
_SINGLE_DAY_RE = re.compile(rf"{_DAYS}|DAILY|DLY", re.I)

# Plausibility bounds for a FIXED-time window (OCR mis-read guard, item PR A/2).
# A digit slip in the OCR (e.g. "0500-2100" read as "0500-0100", or a duration
# of a few minutes) must never publish a confident "open" window. Solar (SR/SS)
# boundaries resolve astronomically at read time and are always kept.
_MIN_WINDOW_MINUTES = 30  # a genuine AD window is at least this long
_MAX_WINDOW_MINUTES = 20 * 60  # longer, yet not "H24", is a likely mis-read


def _is_time_boundary(b: object) -> bool:
    return isinstance(b, dict) and b.get("t") == "time"


def _plausible_day(dh: dict) -> dict:
    """A parsed day, or ``{"kind": "unknown"}`` when a fixed window is
    implausible (degenerate / too short / near-24h-but-not-H24). Non-window
    days and solar-bounded windows pass through untouched."""
    if dh.get("kind") != "window":
        return dh
    o, c = dh.get("open"), dh.get("close")
    if not (_is_time_boundary(o) and _is_time_boundary(c)):
        return dh  # a SR/SS boundary - resolved at read time, always plausible
    om, cm = o.get("m"), c.get("m")
    if not (isinstance(om, int) and isinstance(cm, int)):
        return {"kind": "unknown"}
    if not 0 <= om < cm <= 1440:
        return {"kind": "unknown"}  # degenerate / wrapped / out of range
    span = cm - om
    if span < _MIN_WINDOW_MINUTES or span > _MAX_WINDOW_MINUTES:
        return {"kind": "unknown"}  # implausibly short, or near-24h yet not H24
    return dh


def _guard(hours: StructuredHours | None) -> StructuredHours | None:
    """Reject implausible fixed windows day-by-day; None stays None. When the
    guard empties every day to ``unknown``, publish nothing (no false badge)."""
    if hours is None:
        return None
    guarded = [_plausible_day(d) for d in hours]
    if all(d.get("kind") == "unknown" for d in guarded):
        return None
    return guarded


def _slice_operator_hours(text: str) -> str | None:
    """Extract the AD 2.3 aerodrome-operator hours text from the OCR blob."""
    region = _AD23_RE.search(text)
    if not region:
        return None
    row = _OPERATOR_ROW_RE.search(region.group(1))
    # Fall back to the whole AD 2.3 region when the "AD operator" label did not
    # OCR cleanly - the operator row is first, so the region's leading window is
    # still its hours.
    return (row.group(1) if row else region.group(1)).strip() or None


def _normalise(raw: str) -> str:
    """OCR/German-AIP hours row -> a string parse_ad23_text can read."""
    up = raw.upper()
    # Drop parenthetical winter times "(0400)" - keep the primary (summer) time.
    up = re.sub(r"\([^)]*\)", " ", up)
    # Drop solar offsets that trail SR/SS ("SS+030" -> "SS"). Scoped to SR/SS so
    # it never eats a window-separator hyphen ("0500 - 2100").
    up = re.sub(r"\b(SR|SS)\s*[+\-–—]\s*0?\d{1,3}\b", r"\1", up)
    # Drop solar "MAX HHMM" caps that follow the window.
    up = re.sub(r"\bMAX\s*\d{3,4}\b", " ", up)
    # Normalise OCR dash / equals glyphs to a plain hyphen.
    up = re.sub(r"[–—=]", "-", up)
    return re.sub(r"\s+", " ", up).strip()


def _to_segments(norm: str) -> str | None:
    """Expand the normalised operator row into ``;``-joined single-clause
    segments ("MON-FRI 0500-2100; SAT 0800-SS; SUN 0800-SS") that
    parse_ad23_text reads one day-statement at a time. Comma day-lists become
    one segment per day; HOL (holidays) is dropped."""
    segments: list[str] = []
    for m in _CLAUSE_RE.finditer(norm):
        day_text, o, c = m.group(1).upper(), m.group(2), m.group(3)
        window = f"{o}-{c}"
        used: list[tuple[int, int]] = []
        for r in _RANGE_RE.finditer(day_text):
            segments.append(f"{r.group(1)}-{r.group(2)} {window}")
            used.append(r.span())
        # Standalone days outside any range span (e.g. "SAT", "SUN" in a list).
        for d in _SINGLE_DAY_RE.finditer(day_text):
            if any(s <= d.start() < e for s, e in used):
                continue
            tok = d.group(0).upper()
            if tok == "HOL":  # holidays: no weekday slot
                continue
            segments.append(f"{tok} {window}")
    return "; ".join(segments) or None


def parse_de_hours(text: object) -> StructuredHours | None:
    """DFS AD-2 OCR text -> StructuredHours (7 days), or None.

    Slices the AD 2.3 aerodrome-operator hours, normalises the DFS/OCR quirks,
    and delegates to the shared ``parse_ad23_text``. Fail-soft at every step:
    any missing region / unreadable window yields None (no badge)."""
    if not isinstance(text, str) or not text.strip():
        return None
    hours_text = _slice_operator_hours(text)
    if not hours_text:
        return None
    norm = _normalise(hours_text)
    # H24 / NOTAM-only rows carry no window - hand the normalised text straight
    # to parse_ad23_text (it recognises H24 / by NOTAM); otherwise expand the
    # day-clauses first so comma day-lists survive.
    segments = _to_segments(norm)
    # Guard against OCR digit slips before the hours drive a live badge: an
    # implausible fixed window (degenerate / a few minutes / near-24h yet not
    # H24) is dropped to `unknown` rather than asserted (owner safety directive).
    return _guard(parse_ad23_text(segments if segments else norm))
