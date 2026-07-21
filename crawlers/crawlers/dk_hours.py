"""DK-specific pre-processor: Naviair "VFR Flight Guide Denmark" data-sheet text
-> structured operation hours.

Denmark's AD 2 aerodrome data sheets (``EK_AD_2_<ICAO>_en.pdf`` - the "01. AD 2
<ICAO> text" document in the Naviair tree) do NOT use the ICAO "AD 2.3" section
numbering the shared ``ad23_hours`` parser keys on. They are a flat, bilingual
(English block first, then the Danish block repeats items 1-16) layout where the
operating hours are item **"4. Operational hours"** / **"4. Tjenestetider"**.

Inside item 4 the services are listed per line - APP / TWR / AD / ADO / ARO /
AIS / MET - and the AERODROME'S OWN window is the ``AD:`` row. APP/TWR (approach/
tower) and ARO/AIS/MET (briefing/met) are ATS/service rows, frequently H24, and
must NOT be read as the field's open hours - the same "row 1 wins" rule the
eurocontrol parser applies to the ICAO AD 2.3 table.

This module isolates the English item-4 region, takes the ``AD:`` row, normalises
the AIP quirks (summer bracket, ``PPR`` notes) and reuses the shared
``operating_hours.parse_ad23_text`` so DK lands in the same 7-day shape as every
eAIP country. The data sheet carries a clean text layer (no OCR), so the parsed
hours are the authoritative ``eaip`` source.

Examples (the ``AD:`` row of real data sheets):
  EKBI  "H24"                                     -> H24 every day
  EKAT  "Daily SR-SS"                             -> SR-SS every day
  EKKA  "PPR, see item 16 a. MON-FRI 0500-1700 (0400-1600) SAT-SUN CLSD"
        -> MON-FRI 0500-1700Z, SAT-SUN closed. The "(0400-1600)" is the summer
           shift; the base (winter) UTC value is kept, consistent with the site's
           all-UTC convention (the glossary explains the seasonal bracket).

Fail-soft: returns ``None`` whenever nothing confidently parseable is found (the
field then simply shows no hours badge on the website).
"""

from __future__ import annotations

import re

from crawlers.operating_hours import StructuredHours, parse_ad23_text

# Item 4 "Operational hours" region: from the English heading up to the next
# section (English "Customs/Immigration", or - as a fallback if that wording
# shifts - the Danish block's own headings). Non-greedy, so it stops at the
# FIRST such boundary and captures only the English item 4.
_ITEM4_RE = re.compile(
    r"Operational\s+hours\b(.*?)(?="
    r"Customs\s*/?\s*Immigration|\b5\.\s|Told\s*/?\s*Pas|Beliggenhed"
    r"|Tjenestetider|$)",
    re.I | re.S,
)
# The AD (aerodrome) row within item 4: "AD: <window...>" up to the next service
# label. `\bAD\s*:` matches "AD:" but never "ADO:" (the ":" must follow "AD"),
# so the aerodrome row is isolated from the ADO/ARO/AIS/MET service rows.
_AD_ROW_RE = re.compile(
    r"\bAD\s*:\s*(.*?)(?=\bADO\b|\bARO\b|\bAIS\b|\bMET\b|\bRFF\b|\bRescue\b|$)",
    re.I | re.S,
)
_DAY = r"MON|TUE|WED|THU|FRI|SAT|SUN"
# One statement = a day token (a range / DAILY / H24) plus the text up to the
# next such token. Splitting here keeps BOTH halves of a two-part row like
# "MON-FRI 0500-1700 SAT-SUN CLSD" (a single segment would drop the second).
_STMT_RE = re.compile(
    rf"((?:{_DAY})(?:\s*-\s*(?:{_DAY}))?|DAILY|DLY|H24)(.*?)"
    rf"(?=(?:{_DAY})(?:\s*-\s*(?:{_DAY}))?\b|DAILY|DLY|H24|$)",
    re.I | re.S,
)


def _normalise(raw: str) -> str:
    """Drop the parenthetical summer window and normalise dash glyphs, so what
    is left is the base (winter) UTC value in a shape parse_ad23_text reads."""
    up = raw.upper()
    up = re.sub(r"\([^)]*\)", " ", up)  # drop the "(0400-1600)" summer bracket
    up = re.sub(r"[–—=]", "-", up)  # en/em dash, '=' -> hyphen
    return re.sub(r"\s+", " ", up).strip()


def _segment(norm: str) -> str | None:
    """Split the AD row into ";"-joined per-day statements (each read on its own
    by parse_ad23_text). Text before the first day token (a "PPR, see item 16 a."
    note) carries no day and is dropped."""
    segs = [
        f"{m.group(1).upper()} {m.group(2).strip()}".strip()
        for m in _STMT_RE.finditer(norm)
    ]
    return "; ".join(segs) or None


def parse_dk_hours(text: object) -> StructuredHours | None:
    """Naviair data-sheet text -> StructuredHours (7 days), or None.

    Isolates the English item-4 "Operational hours" region, takes the ``AD:``
    aerodrome row, and delegates to the shared parse_ad23_text. Fail-soft at
    every step; also returns None when the parse yields nothing but ``unknown``
    (a row like a bare "PPR" with no window), so no empty badge is published."""
    if not isinstance(text, str) or not text.strip():
        return None
    region = _ITEM4_RE.search(text)
    if not region:
        return None
    ad = _AD_ROW_RE.search(region.group(1))
    if not ad:
        return None
    norm = _normalise(ad.group(1))
    if not norm:
        return None
    seg = _segment(norm)
    hours = parse_ad23_text(seg if seg else norm)
    if hours is None or all(d.get("kind") == "unknown" for d in hours):
        return None
    return hours
