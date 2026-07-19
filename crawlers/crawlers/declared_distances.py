"""Declared distances (ICAO AD 2.13) parser - TORA / TODA / ASDA / LDA per
runway, from a eurocontrol eAIP AD-2 page's flattened text.

Declared distances are the authoritative take-off / landing distances a pilot
uses for performance planning, and no free dataset (OpenAIP / OurAirports)
carries them structured - so this is a genuine new datapoint. The AD 2.13
section is a standard ICAO table; two flattened-text shapes are handled:

  * **clean** (LVNL / most eurocontrol eAIPs):
      "... RWY designator TORA (M) TODA (M) ASDA (M) LDA (M) Remarks 1 2 3 4 5 6
       08 860 860 860 860 NIL 26 860 860 860 860 NIL"
  * **token-polluted** (NATS/Aurora leaks the eAIP's internal data-attribute
    ids into the text): the real numbers are interleaved with placeholder
    tokens like "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19071 M" - stripped first,
    the row is then the same "<desig> <4 numbers>" shape.

Conservative by design (a wrong declared distance is a safety/performance
hazard): only a runway designator in the valid 01-36 range immediately
followed by four value tokens (a number or ``NIL``) is accepted; anything else
is skipped, and a runway whose four values are all ``NIL`` is dropped. Big
fields (EHAM) publish extra intersection-take-off rows repeating a designator -
the FIRST row per designator (the full-length declared distances) wins.
"""

from __future__ import annotations

import re

# The eAIP internal data-attribute tokens NATS leaks into the flattened text,
# e.g. "TRWY_DIRECTION;TXT_DESIG;188", "TRWY_DIRECTION_DECL_DIST;VAL_DIST;19071",
# "TRWY_DIRECTION_DECL_DIST;ANNOTATION:86737.eng;19071". Shape: WORD;field;id.
_EAIP_TOKEN_RE = re.compile(r"[A-Z][A-Z0-9_]*;[^\s;]+;\d+")
# Column-number header ("... Remarks 1 2 3 4 5 6") that precedes the data rows.
_HEADER_RE = re.compile(r"\bRemarks\b.*?\b1\s+2\s+3\s+4\s+5\s+6\b", re.S)
# A runway designator: 01-36 with an optional L/R/C/G suffix.
_DESIG_RE = re.compile(r"^(0?[1-9]|[12]\d|3[0-6])([LRCG]?)$")
_NUM_RE = re.compile(r"^\d+$")


def _norm_desig(tok: str) -> str | None:
    """A bare runway-designator token -> zero-padded canonical (e.g. "8"->"08",
    "03G"->"03G"), or None if not a valid 01-36[LRCG] designator."""
    m = _DESIG_RE.match(tok)
    if not m:
        return None
    return f"{int(m.group(1)):02d}{m.group(2)}"


def parse_declared_distances(section_text: str) -> dict[str, dict[str, int]]:
    """AD 2.13 section text -> ``{designator: {tora,toda,asda,lda}}`` (metres).

    Only fields the AIP states are included; a ``NIL`` value is omitted from a
    runway's dict (so a landing-only runway yields ``{"lda": 2020}``), and a
    runway with no numeric value at all is dropped. Returns ``{}`` when nothing
    parseable is found (fail-soft; the caller simply stores no declared
    distances). The first row per designator wins over later intersection rows.
    """
    if not section_text:
        return {}
    # 1. Drop the NATS placeholder tokens + the standalone "M" unit each value
    #    carries in that layout, then isolate the body after the
    #    "Remarks 1 2 3 4 5 6" column header (so header words are not parsed).
    text = _EAIP_TOKEN_RE.sub(" ", section_text)
    text = re.sub(r"\bM\b", " ", text)
    header = _HEADER_RE.search(text)
    body = text[header.end():] if header else text
    tokens = body.split()

    out: dict[str, dict[str, int]] = {}
    i = 0
    n = len(tokens)
    while i < n:
        desig = _norm_desig(tokens[i])
        if desig is None:
            i += 1
            continue
        # The next four tokens must each be a number or NIL to count as a row.
        vals = tokens[i + 1 : i + 5]
        if len(vals) < 4 or not all(
            v == "NIL" or _NUM_RE.match(v) for v in vals
        ):
            i += 1
            continue
        i += 5
        if desig in out:  # keep the first (full-length) row for this designator
            continue
        rec: dict[str, int] = {}
        for key, v in zip(("tora", "toda", "asda", "lda"), vals):
            if v != "NIL":
                rec[key] = int(v)
        if rec:  # drop all-NIL runways
            out[desig] = rec
    return out
