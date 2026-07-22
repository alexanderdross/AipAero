"""Unit tests for OutputHandler's publish retry + the new error-visibility
warning bands (soft count drop, "<name> <ICAO>" title format)."""

from __future__ import annotations

import httpx
import pytest

import output_handler as oh_mod
from output_handler import CountDropAbort, OutputHandler
from sanitize import SanitizeReport
from settings import Settings


def _handler() -> OutputHandler:
    return OutputHandler(
        Settings(
            api_endpoint="http://x.test/api/airports",
            api_key="k",
            log_level="INFO",
            log_file="/tmp/aipaero-guards-test.log",
        )
    )


class _Resp:
    def __init__(self, status: int) -> None:
        self.status_code = status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code}", request=None, response=None
            )


class _SeqClient:
    """Yields a preset sequence of statuses / exceptions, one per attempt."""

    seq: list = []
    idx: int = 0

    def __init__(self, *a, **k) -> None:
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a) -> bool:
        return False

    def request(self, method, url, json, headers):  # noqa: A002 - httpx signature
        item = _SeqClient.seq[_SeqClient.idx]
        _SeqClient.idx += 1
        if isinstance(item, Exception):
            raise item
        return _Resp(item)


def _arm(monkeypatch, seq) -> OutputHandler:
    _SeqClient.seq = seq
    _SeqClient.idx = 0
    monkeypatch.setattr(oh_mod.httpx, "Client", _SeqClient)
    monkeypatch.setattr(oh_mod.time, "sleep", lambda *_: None)  # no real backoff
    return _handler()


# ----- publish retry ----------------------------------------------------------


def test_retries_transient_5xx_then_succeeds(monkeypatch):
    h = _arm(monkeypatch, [503, 200])
    resp = h._send_with_retry("POST", "http://x.test", [], "test")
    assert resp.status_code == 200
    assert _SeqClient.idx == 2  # exactly one retry


def test_retries_transport_error_then_succeeds(monkeypatch):
    h = _arm(monkeypatch, [httpx.ConnectError("down"), 200])
    resp = h._send_with_retry("POST", "http://x.test", [], "test")
    assert resp.status_code == 200


def test_gives_up_after_max_attempts(monkeypatch):
    h = _arm(monkeypatch, [503, 503, 503])
    with pytest.raises(httpx.HTTPStatusError):
        h._send_with_retry("POST", "http://x.test", [], "test")
    assert _SeqClient.idx == oh_mod.PUBLISH_MAX_ATTEMPTS


def test_non_retryable_4xx_raises_immediately(monkeypatch):
    h = _arm(monkeypatch, [400, 200])
    with pytest.raises(httpx.HTTPStatusError):
        h._send_with_retry("POST", "http://x.test", [], "test")
    assert _SeqClient.idx == 1  # no retry wasted on a 400


# ----- soft count-drop band ---------------------------------------------------


def test_soft_drop_warns_without_blocking(capsys):
    h = _handler()
    h._last_counts["DE"] = 100
    h._check_count_sanity("DE", 80)  # 20%: within 50% hard block, above 15% soft
    assert "::warning title=Count drop" in capsys.readouterr().out


def test_small_drop_is_silent(capsys):
    h = _handler()
    h._last_counts["DE"] = 100
    h._check_count_sanity("DE", 95)  # 5%: below the soft band
    assert "::warning" not in capsys.readouterr().out


def test_hard_drop_still_raises():
    h = _handler()
    h._last_counts["DE"] = 100
    with pytest.raises(CountDropAbort):
        h._check_count_sanity("DE", 40)  # 60% collapse


# ----- title-format band ------------------------------------------------------


def test_title_format_warns_on_icao_first(capsys):
    rep = SanitizeReport(
        country="DE",
        icao_bearing=10,
        bad_title=3,
        bad_title_samples=["'EDDF Frankfurt'"],
    )
    _handler()._warn_title_format(rep)
    assert "::warning title=Title format" in capsys.readouterr().out


def test_title_format_quiet_when_clean(capsys):
    rep = SanitizeReport(country="DE", icao_bearing=10, bad_title=0)
    _handler()._warn_title_format(rep)
    assert "::warning title=Title format" not in capsys.readouterr().out
