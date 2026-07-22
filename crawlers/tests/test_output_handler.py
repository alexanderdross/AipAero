"""Unit tests for OutputHandler.publish_hours per-field source mapping.

The global pdf_text OCR fallback tags the specific fields whose AD 2.3 hours came
from an image-only PDF as "pdf-ocr-hours" (via `source_by_icao`), while their
clean-text siblings keep the default "eaip". These tests capture the PATCH rows
without a real HTTP call.
"""

from __future__ import annotations

import output_handler as oh_mod
from output_handler import OutputHandler
from settings import Settings

_H24 = [{"kind": "h24"} for _ in range(7)]


def _handler() -> OutputHandler:
    settings = Settings(
        api_endpoint="http://example.test/api/airports",
        api_key="test-key",
        log_level="INFO",
        log_file="/tmp/aipaero-test.log",
    )
    return OutputHandler(settings)


class _FakeResp:
    status_code = 200

    def raise_for_status(self) -> None:
        pass


class _FakeClient:
    """Captures the request json instead of sending it (via client.request,
    which OutputHandler._send_with_retry uses for both POST and PATCH)."""

    captured: dict = {}

    def __init__(self, *args, **kwargs) -> None:
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args) -> bool:
        return False

    def request(self, method, url, json, headers):  # noqa: A002 - httpx signature
        _FakeClient.captured = {"method": method, "url": url, "json": json}
        return _FakeResp()


def _rows_by_icao(monkeypatch, **publish_kwargs) -> dict[str, dict]:
    monkeypatch.setattr(oh_mod.httpx, "Client", _FakeClient)
    _handler().publish_hours(**publish_kwargs)
    return {r["icao"]: r for r in _FakeClient.captured["json"]}


def test_per_field_source_overrides_only_the_ocr_fields(monkeypatch):
    rows = _rows_by_icao(
        monkeypatch,
        hours_by_icao={"LWSK": _H24, "LWOH": _H24},
        country="MK",
        source_by_icao={"LWSK": "pdf-ocr-hours"},
    )
    assert rows["LWSK"]["hoursSource"] == "pdf-ocr-hours"  # OCR fallback field
    assert rows["LWOH"]["hoursSource"] == "eaip"  # clean-text sibling


def test_default_source_is_eaip_without_override(monkeypatch):
    rows = _rows_by_icao(
        monkeypatch,
        hours_by_icao={"LECO": _H24},
        country="ES",
    )
    assert rows["LECO"]["hoursSource"] == "eaip"


def test_source_lookup_is_case_insensitive(monkeypatch):
    # A crawler that cased the ICAO differently in the two maps must still get
    # the OCR tag (rows are keyed upper-case; the lookup upper-cases both sides).
    rows = _rows_by_icao(
        monkeypatch,
        hours_by_icao={"lwsk": _H24},
        country="MK",
        source_by_icao={"LWSK": "pdf-ocr-hours"},
    )
    assert rows["LWSK"]["hoursSource"] == "pdf-ocr-hours"
