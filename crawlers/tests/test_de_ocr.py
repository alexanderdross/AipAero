"""Tests for the DE OCR text-vs-chart page discriminator, using REAL OCR
output captured live (crawler-live-test, 19.07.2026) from DFS BasicVFR."""

from crawlers.de_ocr import biggest_png, is_text_page

# EDNY "VFR-Flugverfahren" - a big field's TEXT page (keep). Trimmed real OCR.
EDNY_TEXT = (
    "FRIEDRICHSHAFEN EDNY VFR-Flugverfahren und Regelung des zivilen "
    "Platzverkehrs / VFR Flight Procedures and Regulation of Civil Aerodrome "
    "Traffic 1. Anfluege, Abfluege 1.1 VFR-An-/Abfluege zum/vom Flughafen "
    "Friedrichshafen sind entsprechend der Sichtflugkarte durchzufuehren. "
    "3. Oertliche Flugbeschraenkungen 3.1.1 Luftfahrzeuge duerfen in der Zeit "
    "von 2100 (2000) bis 0500 (0400) weder starten noch landen." * 3
)

# EDKA aerodrome-chart page - a CHART (skip). Title marker in the head.
EDKA_CHART = (
    "AACHEN-MERZBRUECK N 50 49,30 Flugplatzkarte EDKA E 06 11,05 Aerodrome "
    "Chart Gelbe Warnblinkleuchten Yellow flashing warning lights RWY (MAG) "
    "Dimensions Surface Strength TORA LDA 07 065 1160 x 18m ASPH PPR "
    "Beexetere BEE VE EEE uonauodg odoy NO" * 3
)

# EDNX Sichtflugkarte - a CHART (skip).
EDNX_CHART = (
    "Sichtflugkarte OBERSCHLEISSHEIM Visual Operation Chart ELEV 1596 EDNX "
    "LANGEN INFORMATION 126.950 11 33 11 35 11 36 Einfluege in die Platzrunde "
    "generell aus Nordwest ueber Hackermoos." * 3
)


def test_text_page_kept():
    assert is_text_page(EDNY_TEXT) is True


def test_chart_pages_skipped():
    assert is_text_page(EDKA_CHART) is False  # "Flugplatzkarte" marker in head
    assert is_text_page(EDNX_CHART) is False  # "Sichtflugkarte" marker in head


def test_short_or_empty_skipped():
    assert is_text_page("") is False
    assert is_text_page("FRIEDRICHSHAFEN EDNY VFR-Flugverfahren") is False


def test_biggest_png_picks_largest():
    import base64

    small = base64.b64encode(b"\x89PNG" + b"a" * 20).decode()
    big = base64.b64encode(b"\x89PNG" + b"b" * 500).decode()
    html = (
        f'<img src="data:image/png;base64,{small}">'
        f'<img src="data:image/png;base64,{big}">'
    )
    got = biggest_png(html)
    assert got is not None and got.startswith(b"\x89PNG") and len(got) > 400


def test_biggest_png_none_when_absent():
    assert biggest_png("<html>no images</html>") is None
