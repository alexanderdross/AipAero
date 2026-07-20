"""Tests for the DE OCR text-vs-chart page discriminator, using REAL OCR
output captured live (crawler-live-test, 19.07.2026) from DFS BasicVFR."""

from crawlers.de import _TEXT_PAGE_RE
from crawlers.de_ocr import biggest_png, is_text_page, page_language

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


# A German AD-2 narrative page (real OCR shape from EDNY 1-9): the local
# flight-restriction translation. Must route to the German blob.
EDNY_DE_NARRATIVE = (
    "LUFTFAHRTHANDBUCH DEUTSCHLAND AIP GERMANY AD 2 EDNY 1-9 9) wiederholte "
    "An- und Abfluege aus meteorologischen, technischen oder sonstigen "
    "Sicherheitsgruenden; Flugbewegungen im Einsatz fuer den "
    "Katastrophenschutz, im besonderen. Starts an Sonn- und Feiertagen von "
    "1130 bis 1330, soweit die Luftfahrzeuge bei einer Zulassung nach Kapitel "
    "die Laermgrenzwerte der Laermschutzanforderungen fuer Luftfahrzeuge "
    "einhalten. Probe- und Standlaeufe innerhalb der Laermdaemmungsanlage."
)


# A standardized AD 2.1-2.3 data page (real OCR shape): English labels, the
# ICAO-standard fields. Must route to the English blob.
EDNY_EN_DATA = (
    "EDNY AD 2.1 Aerodrome location indicator and name EDNY FRIEDRICHSHAFEN "
    "EDNY AD 2.2 Aerodrome geographical and administrative data ARP "
    "coordinates and site at AD Direction and distance of ARP from city "
    "Elevation reference temperature AD operator address telephone Types of "
    "traffic permitted IFR VFR AD 2.3 Operational hours AD operator "
    "Customs and immigration Health and sanitation Fueling Handling"
)


def test_page_language_english_vs_german():
    # The standardized English data page -> "en".
    assert page_language(EDNY_EN_DATA) == "en"
    # The German VFR-Flugverfahren page and the translated narrative -> "de".
    assert page_language(EDNY_TEXT) == "de"
    assert page_language(EDNY_DE_NARRATIVE) == "de"


def test_page_language_ties_to_english():
    assert page_language("") == "en"
    assert page_language("1234 5678 ---") == "en"


def test_text_page_anchor_regex():
    # Real anchor labels from the rendered EDNY landing (live 19.07.2026): the
    # AD 2 book's section-1 pages are the TEXT sheets; 2-x/3-x/4-x/5-x are charts.
    for label in ("AD 2 EDNY 1-3 AD 2 EDNY 1-3", "AD 2 EDDH 1-10"):
        m = _TEXT_PAGE_RE.match(label)
        assert m is not None and m.group(1) == label.split()[2]
    # Chart pages and unrelated labels must NOT match (kept out of the OCR set).
    for label in (
        "AD 2 EDNY 2-5 Aerodrome Chart - ICAO",
        "AD 2 EDNY 4-2-1 INSTRUMENT APPROACH CHART",
        "EDNY 1",
        "Legal Notice",
    ):
        assert _TEXT_PAGE_RE.match(label) is None
