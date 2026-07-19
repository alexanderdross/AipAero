"""Structured aerodrome operation hours - the Python twin of
``src/lib/opening-hours.ts``.

Two inputs, ONE output shape (so the website reads either the same way):

  * ``parse_openaip_hours(hours_of_operation)`` - OpenAIP's structured
    ``hoursOfOperation`` object (used by the OpenAIP coord backfill).
  * ``parse_ad23_text(text)`` - the free-text eAIP AD 2.3 "OPERATIONAL HOURS"
    row (used by the eurocontrol crawler, the AUTHORITATIVE source).

Output = a list of 7 day-dicts, index 0 = Monday .. 6 = Sunday, each one of:

  {"kind": "window", "open": <boundary>, "close": <boundary>}
  {"kind": "h24"} | {"kind": "closed"} | {"kind": "notam"} | {"kind": "unknown"}

where <boundary> is {"t": "time", "m": <minutes 0..1439>} | {"t": "sr"} |
{"t": "ss"}. Minutes are LOCAL. ``to_json`` serialises it; the website
(opening-hours.ts) resolves sunrise/sunset and evaluates "open until X".

Safety: anything not confidently parseable is ``unknown`` (never guessed) - the
website excludes ``unknown``/``notam`` from "open" answers.
"""

from __future__ import annotations

import json
import re

DayHours = dict
StructuredHours = list  # length 7

_DAY_INDEX = {
    "MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6,
}
_DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def _hhmm_minutes(v: object) -> int | None:
    """"HH:MM" / "HHMM" -> minutes after midnight, else None."""
    if not isinstance(v, str):
        return None
    m = re.match(r"^(\d{2}):?(\d{2})", v.strip())
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 24 or mi > 59:
        return None
    return h * 60 + mi


def _unknown_week() -> StructuredHours:
    return [{"kind": "unknown"} for _ in range(7)]


# ---- OpenAIP structured -------------------------------------------------------


def _openaip_day(entry: dict) -> DayHours:
    if entry.get("byNotam") is True:
        return {"kind": "notam"}
    if entry.get("sunrise") is True:
        open_b: dict | None = {"t": "sr"}
    else:
        m = _hhmm_minutes(entry.get("startTime"))
        open_b = {"t": "time", "m": m} if m is not None else None
    if entry.get("sunset") is True:
        close_b: dict | None = {"t": "ss"}
    else:
        m = _hhmm_minutes(entry.get("endTime"))
        close_b = {"t": "time", "m": m} if m is not None else None
    if open_b is None or close_b is None:
        return {"kind": "unknown"}
    return {"kind": "window", "open": open_b, "close": close_b}


def parse_openaip_hours(raw: object) -> StructuredHours | None:
    """OpenAIP ``hoursOfOperation`` -> StructuredHours, or None when there is no
    usable ``operatingHours`` array. Days not mentioned become ``unknown``."""
    if not isinstance(raw, dict):
        return None
    entries = raw.get("operatingHours")
    if not isinstance(entries, list):
        return None
    days: list[DayHours | None] = [None] * 7
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        d = entry.get("dayOfWeek")
        if not isinstance(d, int) or d < 0 or d > 6:
            continue
        if days[d] is not None:
            continue  # first wins
        days[d] = _openaip_day(entry)
    if all(d is None for d in days):
        return None
    return [d if d is not None else {"kind": "unknown"} for d in days]


# ---- eAIP AD 2.3 free text ----------------------------------------------------

# A time window token: "0800-1700", "0800-SS", "SR-2000", "SR-SS".
_TIME = r"(?:\d{3,4}|SR|SS)"
_WINDOW_RE = re.compile(rf"\b({_TIME})\s*[-–—]\s*({_TIME})\b")
# A day-range prefix: "MON-FRI", "MON", "SAT-SUN"; also "DAILY"/"DLY".
_DAYRANGE_RE = re.compile(
    r"\b(MON|TUE|WED|THU|FRI|SAT|SUN)(?:\s*[-–—]\s*"
    r"(MON|TUE|WED|THU|FRI|SAT|SUN))?\b"
)
# Tokens that mean "not assertable" - the whole field is by request / PPR / etc.
_UNASSERTABLE_RE = re.compile(r"\b(O/?R|PPR|ON REQUEST|AS REQUIRED|HX|HO)\b")


def _boundary(tok: str) -> dict | None:
    tok = tok.upper()
    if tok == "SR":
        return {"t": "sr"}
    if tok == "SS":
        return {"t": "ss"}
    m = _hhmm_minutes(tok)
    return {"t": "time", "m": m} if m is not None else None


def _days_in_range(a: str, b: str | None) -> list[int]:
    start = _DAY_INDEX[a]
    if b is None:
        return [start]
    end = _DAY_INDEX[b]
    if end >= start:
        return list(range(start, end + 1))
    # wrap (e.g. SAT-MON) - rare, but handle
    return list(range(start, 7)) + list(range(0, end + 1))


def parse_ad23_text(text: object) -> StructuredHours | None:
    """Best-effort parse of an eAIP AD 2.3 "OPERATIONAL HOURS" value into
    StructuredHours. Handles ``H24``, ``MON-FRI 0800-1700`` (and day ranges),
    ``SR-SS`` / ``0800-SS`` windows, multiple ``;``/newline segments, and
    ``by NOTAM``. Days left uncovered - and any O/R / PPR / HO / unrecognised
    text - stay ``unknown`` (never guessed). Returns None when nothing at all
    could be read."""
    if not isinstance(text, str):
        return None
    up = re.sub(r"\s+", " ", text.upper()).strip()
    if not up:
        return None

    # Whole-field NOTAM (no concrete window alongside it).
    if "NOTAM" in up and not _WINDOW_RE.search(up):
        return [{"kind": "notam"} for _ in range(7)]

    # Plain H24 with no day qualifier -> open all week.
    if re.search(r"\bH24\b", up) and not _DAYRANGE_RE.search(up):
        return [{"kind": "h24"} for _ in range(7)]

    days: list[DayHours | None] = [None] * 7
    # Split into segments on ; or newlines; each segment may carry its own days.
    for seg in re.split(r"[;\n]", up):
        seg = seg.strip()
        if not seg:
            continue
        day_idxs: list[int]
        drm = _DAYRANGE_RE.search(seg)
        if "DAILY" in seg or "DLY" in seg:
            day_idxs = list(range(7))
        elif drm:
            day_idxs = _days_in_range(drm.group(1), drm.group(2))
        else:
            day_idxs = list(range(7))  # window with no day prefix -> whole week

        if re.search(r"\bH24\b", seg):
            dh: DayHours = {"kind": "h24"}
        else:
            wm = _WINDOW_RE.search(seg)
            if wm:
                open_b = _boundary(wm.group(1))
                close_b = _boundary(wm.group(2))
                dh = (
                    {"kind": "window", "open": open_b, "close": close_b}
                    if open_b and close_b
                    else {"kind": "unknown"}
                )
            elif _UNASSERTABLE_RE.search(seg):
                dh = {"kind": "unknown"}
            else:
                continue  # nothing usable in this segment
        for i in day_idxs:
            if days[i] is None:  # first statement for a day wins
                days[i] = dh

    if all(d is None for d in days):
        return None
    return [d if d is not None else {"kind": "unknown"} for d in days]


def to_json(hours: StructuredHours | None) -> str | None:
    """Serialise StructuredHours for POSTing to the website (or None)."""
    return None if hours is None else json.dumps(hours, separators=(",", ":"))
