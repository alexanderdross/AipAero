"""Unit tests for the pdf_text OCR fallback (image-only eAIP PDFs).

The real rasteriser (pypdfium2) + Tesseract are exercised live on the runner;
here we mock both so the logic - "OCR only when the text layer is empty", the
page cap, provenance flag, and fail-soft paths - is covered without them.
"""

from __future__ import annotations

import sys

import pypdf
import pytest

from crawlers.http_base import HttpCrawlerBase


class _Resp:
    def __init__(self, content: bytes) -> None:
        self.content = content

    def raise_for_status(self) -> None:
        pass


class _Page:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


class _Reader:
    def __init__(self, pages: list[_Page]) -> None:
        self.pages = pages


@pytest.fixture
def crawler():
    c = HttpCrawlerBase("XX")
    yield c
    c.close()


def _patch_get(crawler, monkeypatch, content: bytes = b"%PDF-1.4 fake") -> None:
    monkeypatch.setattr(crawler.client, "get", lambda url: _Resp(content))


# ----- pypdf text present -> no OCR ------------------------------------------


def test_uses_pypdf_text_and_never_ocrs_when_text_present(crawler, monkeypatch):
    _patch_get(crawler, monkeypatch)
    monkeypatch.setattr(
        pypdf,
        "PdfReader",
        lambda buf: _Reader(
            [_Page("AD 2.3 OPERATIONAL HOURS MON - FRI 0500 - 2100 daily")]
        ),
    )
    ocr_called = {"n": 0}

    def _no_ocr(_content: bytes) -> str:
        ocr_called["n"] += 1
        return "SHOULD NOT BE USED"

    monkeypatch.setattr(crawler, "_pdf_ocr_text", _no_ocr)

    out = crawler.pdf_text("http://x/f.pdf")
    assert "OPERATIONAL HOURS" in out
    assert crawler._last_pdf_ocr is False
    assert ocr_called["n"] == 0  # non-empty text layer -> OCR never runs


# ----- empty text layer -> OCR fallback --------------------------------------


def test_ocr_fallback_when_text_layer_empty(crawler, monkeypatch):
    _patch_get(crawler, monkeypatch)
    monkeypatch.setattr(pypdf, "PdfReader", lambda buf: _Reader([_Page("")]))
    monkeypatch.setattr(
        crawler, "_pdf_ocr_text", lambda _c: "AD 2.3 OCR MON - FRI 0500 - 2100"
    )

    out = crawler.pdf_text("http://x/scan.pdf")
    assert out == "AD 2.3 OCR MON - FRI 0500 - 2100"
    assert crawler._last_pdf_ocr is True  # provenance flag set for the caller


def test_empty_text_and_empty_ocr_returns_empty(crawler, monkeypatch):
    _patch_get(crawler, monkeypatch)
    monkeypatch.setattr(pypdf, "PdfReader", lambda buf: _Reader([_Page("")]))
    monkeypatch.setattr(crawler, "_pdf_ocr_text", lambda _c: "")

    assert crawler.pdf_text("http://x/scan.pdf") == ""
    assert crawler._last_pdf_ocr is False


def test_download_failure_is_soft(crawler, monkeypatch):
    def _boom(_url):
        raise RuntimeError("network down")

    monkeypatch.setattr(crawler.client, "get", _boom)
    assert crawler.pdf_text("http://x/f.pdf") == ""
    assert crawler._last_pdf_ocr is False


# ----- _pdf_ocr_text internals -----------------------------------------------


def test_pdf_ocr_text_honours_page_cap(crawler, monkeypatch):
    import crawlers.de_ocr as de_ocr

    class _Bitmap:
        def to_pil(self):
            return object()

    class _PageObj:
        def render(self, scale):  # noqa: ANN001
            return _Bitmap()

    class _Doc:
        def __init__(self, _b):
            pass

        def __len__(self):
            return 10  # more pages than the cap

        def __getitem__(self, _i):
            return _PageObj()

        def close(self):
            pass

    import pypdfium2

    monkeypatch.setattr(pypdfium2, "PdfDocument", _Doc)
    calls = {"n": 0}

    def _fake_ocr(_img, _lang):
        calls["n"] += 1
        return "p"

    monkeypatch.setattr(de_ocr, "ocr_pil", _fake_ocr)

    out = crawler._pdf_ocr_text(b"pdf-bytes")
    assert calls["n"] == crawler.MAX_OCR_PAGES  # capped, not all 10 pages
    assert out == " ".join(["p"] * crawler.MAX_OCR_PAGES)


def test_pdf_ocr_text_soft_when_renderer_missing(crawler, monkeypatch):
    # Simulate pypdfium2 not installed: import raises ImportError -> "".
    monkeypatch.setitem(sys.modules, "pypdfium2", None)
    assert crawler._pdf_ocr_text(b"pdf-bytes") == ""


def test_pdf_ocr_text_uses_crawler_language(crawler, monkeypatch):
    import crawlers.de_ocr as de_ocr

    class _Bitmap:
        def to_pil(self):
            return "IMG"

    class _PageObj:
        def render(self, scale):  # noqa: ANN001
            return _Bitmap()

    class _Doc:
        def __init__(self, _b):
            pass

        def __len__(self):
            return 1

        def __getitem__(self, _i):
            return _PageObj()

        def close(self):
            pass

    import pypdfium2

    monkeypatch.setattr(pypdfium2, "PdfDocument", _Doc)
    seen = {}

    def _fake_ocr(img, lang):
        seen["img"] = img
        seen["lang"] = lang
        return "x"

    monkeypatch.setattr(de_ocr, "ocr_pil", _fake_ocr)
    crawler.PDF_OCR_LANG = "ell+eng"
    crawler._pdf_ocr_text(b"pdf-bytes")
    assert seen == {"img": "IMG", "lang": "ell+eng"}


# ----- collect_pdf_hours (the shared caller helper) --------------------------

# The helper lazily imports ad23_hours from this module; monkeypatch it there so
# the tests isolate the record + provenance logic from the parser internals.
import crawlers.http_eurocontrol_base as _heb  # noqa: E402

_HOURS = [{"kind": "h24"} for _ in range(7)]


def test_collect_pdf_hours_records_clean_text_as_default(crawler, monkeypatch):
    monkeypatch.setattr(crawler, "pdf_text", lambda url: "some text")
    monkeypatch.setattr(_heb, "ad23_hours", lambda text: _HOURS)
    crawler._last_pdf_ocr = False
    crawler.collect_pdf_hours("LECO", "http://x/f.pdf")
    assert crawler.hours_by_icao["LECO"] == _HOURS
    # No OCR -> no provenance override (publish defaults it to "eaip").
    assert "LECO" not in crawler.hours_source_by_icao


def test_collect_pdf_hours_stamps_ocr_provenance(crawler, monkeypatch):
    def _pdf_text(url):
        crawler._last_pdf_ocr = True  # simulate the OCR fallback firing
        return "some text"

    monkeypatch.setattr(crawler, "pdf_text", _pdf_text)
    monkeypatch.setattr(_heb, "ad23_hours", lambda text: _HOURS)
    crawler.collect_pdf_hours("LWSK", "http://x/scan.pdf")
    assert crawler.hours_by_icao["LWSK"] == _HOURS
    assert crawler.hours_source_by_icao["LWSK"] == "pdf-ocr-hours"


def test_collect_pdf_hours_soft_no_hours_and_on_error(crawler, monkeypatch):
    monkeypatch.setattr(crawler, "pdf_text", lambda url: "no hours here")
    monkeypatch.setattr(_heb, "ad23_hours", lambda text: None)
    crawler.collect_pdf_hours("LXXX", "http://x/f.pdf")
    assert "LXXX" not in crawler.hours_by_icao
    assert "LXXX" not in crawler.hours_source_by_icao

    def _boom(url):
        raise RuntimeError("bad pdf")

    monkeypatch.setattr(crawler, "pdf_text", _boom)
    crawler.collect_pdf_hours("LYYY", "http://x/f.pdf")  # must not raise
    assert "LYYY" not in crawler.hours_by_icao


# ----- collect_pdf_hours OCR plausibility guard ------------------------------


def _win(o, c):
    return {"kind": "window", "open": {"t": "time", "m": o}, "close": {"t": "time", "m": c}}


def test_collect_pdf_hours_guards_all_implausible_ocr_windows(crawler, monkeypatch):
    # OCR fallback fired and every day is a 5-minute window -> the guard empties
    # them all -> None -> nothing published (no false "open" badge).
    bad = [_win(600, 605) for _ in range(7)]

    def _pdf_text(url):
        crawler._last_pdf_ocr = True
        return "text"

    monkeypatch.setattr(crawler, "pdf_text", _pdf_text)
    monkeypatch.setattr(_heb, "ad23_hours", lambda text: bad)
    crawler.collect_pdf_hours("LGRP", "http://x/scan.pdf")
    assert "LGRP" not in crawler.hours_by_icao
    assert "LGRP" not in crawler.hours_source_by_icao


def test_collect_pdf_hours_guards_only_the_bad_day(crawler, monkeypatch):
    # A plausible MON window survives; a degenerate SUN window is dropped to
    # unknown, and the field still publishes as pdf-ocr-hours.
    hrs = (
        [_win(480, 1200)]
        + [{"kind": "unknown"} for _ in range(5)]
        + [_win(600, 601)]
    )

    def _pdf_text(url):
        crawler._last_pdf_ocr = True
        return "text"

    monkeypatch.setattr(crawler, "pdf_text", _pdf_text)
    monkeypatch.setattr(_heb, "ad23_hours", lambda text: hrs)
    crawler.collect_pdf_hours("LGKO", "http://x/scan.pdf")
    stored = crawler.hours_by_icao["LGKO"]
    assert stored[0] == _win(480, 1200)  # plausible kept
    assert stored[6] == {"kind": "unknown"}  # degenerate dropped
    assert crawler.hours_source_by_icao["LGKO"] == "pdf-ocr-hours"


def test_collect_pdf_hours_clean_text_is_not_guarded(crawler, monkeypatch):
    # Clean text-layer PDF (no OCR): a >20h window the OCR guard WOULD drop is
    # trusted as-is - a legit long window must not become a false negative.
    longwin = [_win(30, 1430) for _ in range(7)]  # ~23h20 span
    monkeypatch.setattr(crawler, "pdf_text", lambda url: "text")
    monkeypatch.setattr(_heb, "ad23_hours", lambda text: longwin)
    crawler._last_pdf_ocr = False
    crawler.collect_pdf_hours("LEXX", "http://x/f.pdf")
    assert crawler.hours_by_icao["LEXX"] == longwin  # unguarded, kept intact
