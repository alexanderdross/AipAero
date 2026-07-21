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
