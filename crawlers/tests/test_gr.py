"""Unit tests for the Greece crawler's Bright Data zone selection.

GR's entry is a server-side reCAPTCHA gate, so it needs the Web Unlocker zone
(BRIGHTDATA_UNLOCKER_URL). A plain proxy (BRIGHTDATA_PROXY_URL) clears the IP
block but not the captcha, so it is only a fallback. These tests assert the
preference order without any network / real proxy.
"""

from __future__ import annotations

import pytest

from crawlers import gr as gr_module
from crawlers.gr import GR


@pytest.fixture(autouse=True)
def _capture_use_proxy(monkeypatch):
    """Record every use_proxy(url) call instead of opening a real client."""
    calls: list[str] = []
    monkeypatch.setattr(GR, "use_proxy", lambda self, url: calls.append(url))
    # use_browser_headers touches the live httpx client - make it a no-op too.
    monkeypatch.setattr(GR, "use_browser_headers", lambda self: None)
    return calls


def test_prefers_unlocker_over_proxy(monkeypatch, _capture_use_proxy):
    monkeypatch.setenv("BRIGHTDATA_UNLOCKER_URL", "http://u:p@unlocker.test:1")
    monkeypatch.setenv("BRIGHTDATA_PROXY_URL", "http://u:p@proxy.test:2")
    gr = GR()
    assert _capture_use_proxy == ["http://u:p@unlocker.test:1"]
    gr.close()


def test_falls_back_to_plain_proxy(monkeypatch, _capture_use_proxy):
    monkeypatch.delenv("BRIGHTDATA_UNLOCKER_URL", raising=False)
    monkeypatch.setenv("BRIGHTDATA_PROXY_URL", "http://u:p@proxy.test:2")
    gr = GR()
    assert _capture_use_proxy == ["http://u:p@proxy.test:2"]
    gr.close()


def test_no_zone_configured_does_not_route(monkeypatch, _capture_use_proxy):
    monkeypatch.delenv("BRIGHTDATA_UNLOCKER_URL", raising=False)
    monkeypatch.delenv("BRIGHTDATA_PROXY_URL", raising=False)
    gr = GR()
    assert _capture_use_proxy == []
    gr.close()


def test_module_root_url_is_hasp():
    assert gr_module.ROOT_URL == "https://aisgr.hasp.gov.gr/"
