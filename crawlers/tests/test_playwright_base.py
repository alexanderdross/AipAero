"""Unit tests for PlaywrightCrawlerBase.

The rendering path itself needs a real browser (exercised by the live-crawl
test, not here). These tests cover the contract that keeps the browserless
paths safe: importing / constructing a crawler must not launch anything,
close() must be safe before any render, and a missing browser must surface as
a catchable PlaywrightUnavailable rather than a raw crash.
"""

from __future__ import annotations

import pytest

from crawlers.playwright_base import PlaywrightCrawlerBase, PlaywrightUnavailable


class _Concrete(PlaywrightCrawlerBase):
    def crawl(self):  # pragma: no cover - not invoked here
        return []


def test_construction_launches_no_browser():
    # Constructing must be cheap and browserless (the import-smoke test relies
    # on this): no playwright process, no browser handle.
    c = _Concrete("dk")
    assert c._browser is None
    assert c._pw is None
    c.close()


def test_close_is_safe_before_any_render():
    c = _Concrete("dk")
    c.close()  # must not raise even though nothing was ever launched
    c.close()  # idempotent


def test_render_raises_playwright_unavailable_when_launch_fails(monkeypatch):
    c = _Concrete("dk")

    def boom():
        raise PlaywrightUnavailable("no browser")

    monkeypatch.setattr(c, "_ensure_browser", boom)
    try:
        with pytest.raises(PlaywrightUnavailable):
            c.render_html("https://example.test/")
    finally:
        c.close()


def test_country_is_uppercased_via_base():
    c = _Concrete("dk")
    assert c.country == "DK"
    c.close()
