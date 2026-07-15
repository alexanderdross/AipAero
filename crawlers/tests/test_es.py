"""Unit tests for the ES (ENAIRE) chart-PDF href pattern.

The AD 2.24 chart PDFs are `LE_AD_2_<ICAO>_<TYPE>_<N>_en.pdf`, but a few
aerodromes share a combined folder under a dual designator (LECU/LEVS), whose
charts carry both keys (`LE_AD_2_LECU_LEVS_<TYPE>_<N>_en.pdf`). The pattern must
capture those without shifting the group indices, keep matching the ordinary
single-key files, and never match the bare AD-2 document.
"""

from __future__ import annotations

from crawlers.es import _CHART_HREF_RE


def _m(href: str):
    return _CHART_HREF_RE.search(href)


def test_dual_key_folder_matches_first_icao() -> None:
    m = _m("contenido_AIP/AD/AD2/LECU_LEVS/LE_AD_2_LECU_LEVS_VAC_1_en.pdf")
    assert m is not None
    assert m.group(1) == "LECU"  # emitted under the first ICAO
    assert m.group(2) == "VAC"
    assert m.group(3) == "1"


def test_single_key_still_matches() -> None:
    m = _m("contenido_AIP/AD/AD2/LECO/LE_AD_2_LECO_VAC_1_en.pdf")
    assert m is not None
    assert (m.group(1), m.group(2), m.group(3)) == ("LECO", "VAC", "1")


def test_four_letter_type_is_not_swallowed_as_a_second_icao() -> None:
    # APDC / PATC are 4-letter TYPE codes; the optional second-ICAO group must
    # backtrack so they parse as the type, not as a second designator.
    for href, typ in [
        ("contenido_AIP/AD/AD2/LEMD/LE_AD_2_LEMD_APDC_1_en.pdf", "APDC"),
        ("contenido_AIP/AD/AD2/LEMD/LE_AD_2_LEMD_PATC_2_en.pdf", "PATC"),
    ]:
        m = _m(href)
        assert m is not None
        assert m.group(1) == "LEMD"
        assert m.group(2) == typ


def test_bare_ad2_document_does_not_match() -> None:
    # The full AD-2 document (no TYPE) is not a single chart.
    assert _m("contenido_AIP/AD/AD2/LECO/LE_AD_2_LECO_en.pdf") is None
