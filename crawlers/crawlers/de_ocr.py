"""OCR helper for the DFS (DE) AD-2 page images.

DFS BasicVFR serves each AD-2 book page as a base64-embedded PNG image, not
text (proven live: `get_text()` returns only page chrome). The only route to
any DE AD-2 datum is OCR - and per the owner's safety directive the OCR output
is **raw DISPLAY text only, never a structured claim** (a mis-OCR'd digit in an
operating-hours window would be a hazard under the "never assert a wrong open"
rule). So this module reads the image into text; nothing here parses it.

Two page kinds exist, and OCR behaves very differently on each (recon
19.07.2026):
  * **text pages** (the ~40 big Verkehrsflughaefen - "VFR-Flugverfahren" /
    apron rules / local flight restrictions): dense typeset prose - OCRs
    cleanly and is worth showing.
  * **chart pages** (the ~750 small fields - Sichtflugkarte / Flugplatzkarte):
    a MAP image - OCR is mostly garbage (coordinate ticks, rotated labels).
`is_text_page` keeps only the former, so a field with only chart pages yields
nothing (it stays on the AIP link, no noisy block).

`pytesseract` / `Pillow` are imported lazily (like the Playwright browser) so a
tesseract-less environment still imports the crawler; the system `tesseract-ocr`
(+ `tesseract-ocr-deu`) binary must be installed on the runner.
"""

from __future__ import annotations

import base64
import io
import re

# Text-vs-chart discriminator (recon-validated on EDNY/EDDH text pages vs
# EDKA/EDPA/EDXA/EDNX chart pages). A CHART page carries the aerodrome's
# lat/lon reference coordinates near the top ("N 50 49,30 ... E 06 11,05") -
# text pages never do. A chart TITLE marker in the head is a secondary signal;
# it is checked only in the first ~150 chars because text pages MENTION
# "Sichtflugkarte" / "Visual Operation Chart" mid-prose (EDNY: "conducted
# according to the Visual Operation Chart"), which must not misclassify them.
_CHART_MARKERS = (
    "Sichtflugkarte",
    "Flugplatzkarte",
    "Visual Operation Chart",
    "Aerodrome Chart",
)
# A latitude "N <deg>" followed shortly by a longitude "E <deg>" - the aerodrome
# reference point printed at the top of every chart page.
_COORD_HEAD_RE = re.compile(r"\bN\s*\d{1,2}\b.{0,80}?\bE\s*\d{1,2}\b", re.S)
_PNG_DATA_RE = re.compile(r"data:image/png;base64,([A-Za-z0-9+/=]+)")


def biggest_png(html: str) -> bytes | None:
    """The largest embedded `data:image/png;base64` payload on a page = the
    full AD-2 scan (the small ones are UI icons), or None."""
    best = b""
    for m in _PNG_DATA_RE.finditer(html):
        try:
            raw = base64.b64decode(m.group(1))
        except Exception:
            continue
        if len(raw) > len(best):
            best = raw
    return best or None


def ocr_image(png: bytes) -> str:
    """Decode a PNG + Tesseract (German + English) -> whitespace-collapsed
    text, or "" on any failure (missing binary, unreadable image). Fail-soft
    and lazy-imported."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return ""
    try:
        img = Image.open(io.BytesIO(png))
        return " ".join(pytesseract.image_to_string(img, lang="deu+eng").split())
    except Exception:
        return ""


def is_text_page(text: str, *, min_len: int = 400) -> bool:
    """True when OCR text looks like a DFS AD-2 **text** data page worth keeping,
    False for a **chart** page (map -> noisy OCR) or a too-short/empty read.

    `de.py` now feeds only the AD 2 book's section-1 TEXT series ("AD 2 <ICAO>
    1-<n>"), so the chart-title / coordinate-header checks are a secondary
    safeguard; the length floor is the main guard against a near-empty/failed
    read. It is 400 (was 1200): valid but shorter AD-2 text pages (e.g. EDNY 1-2
    "AD 2.4 Handling services", ~1087 OCR chars) must not be dropped."""
    if len(text) < min_len:
        return False
    head = text[:150]
    if _COORD_HEAD_RE.search(head):  # aerodrome ref coordinates -> chart page
        return False
    return not any(marker in head for marker in _CHART_MARKERS)
