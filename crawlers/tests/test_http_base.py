"""Unit tests for HttpCrawlerBase.

The base class is a thin wrapper around `httpx.Client` plus a few HTML
helpers. We test the helpers against synthetic HTML and the network
layer with httpx's `MockTransport`, so nothing here makes real
requests.
"""

from __future__ import annotations

import httpx
import pytest

from crawlers.http_base import HttpCrawlerBase


class _Concrete(HttpCrawlerBase):
    """Smallest possible subclass — `crawl()` is the only abstract bit."""

    def crawl(self):  # pragma: no cover - never invoked in tests
        return []


@pytest.fixture
def crawler() -> _Concrete:
    c = _Concrete("xx")
    yield c
    c.close()


# ----- construction & lifecycle -----------------------------------------------


def test_country_is_uppercased():
    c = _Concrete("nl")
    assert c.country == "NL"
    c.close()


def test_close_is_idempotent(crawler: _Concrete):
    crawler.close()
    crawler.close()  # second call must not raise


def test_context_manager_closes_client():
    with _Concrete("nl") as c:
        assert not c.client.is_closed
    assert c.client.is_closed


# ----- clean_text -------------------------------------------------------------


def test_clean_text_collapses_whitespace_and_unescapes(crawler: _Concrete):
    assert crawler.clean_text("  Wien&nbsp;&mdash;\n\tSchwechat ") == "Wien — Schwechat"


def test_clean_text_handles_none_and_empty(crawler: _Concrete):
    assert crawler.clean_text(None) == ""
    assert crawler.clean_text("") == ""


# ----- frame helpers ----------------------------------------------------------


def test_get_frame_src_resolves_relative_url(crawler: _Concrete):
    html = """<frameset>
        <frame name="eAISNavigationBase" src="nav/index.html">
        <frame name="content" src="content.html">
    </frameset>"""
    src = crawler.get_frame_src(html, "https://example.test/eaip/", "eAISNavigationBase")
    assert src == "https://example.test/eaip/nav/index.html"


def test_get_frame_src_supports_iframes(crawler: _Concrete):
    html = '<iframe name="inner" src="/deep.html"></iframe>'
    assert (
        crawler.get_frame_src(html, "https://example.test/a/b", "inner")
        == "https://example.test/deep.html"
    )


def test_get_frame_src_raises_when_frame_missing(crawler: _Concrete):
    with pytest.raises(ValueError, match="not found"):
        crawler.get_frame_src("<frameset></frameset>", "https://x/", "missing")


def test_get_frame_src_raises_when_src_missing(crawler: _Concrete):
    html = '<frame name="content"></frame>'
    with pytest.raises(ValueError, match="no src"):
        crawler.get_frame_src(html, "https://x/", "content")


# ----- network: fetch + follow_frame_chain ------------------------------------


def _mock(routes: dict[str, str]) -> httpx.MockTransport:
    """Return a MockTransport that serves the given URL→HTML map."""

    def handler(request: httpx.Request) -> httpx.Response:
        body = routes.get(str(request.url))
        if body is None:
            return httpx.Response(404, text=f"unrouted {request.url}")
        return httpx.Response(200, html=body)

    return httpx.MockTransport(handler)


def test_fetch_returns_response_text():
    routes = {"https://example.test/a.html": "<p>hi</p>"}
    c = _Concrete("xx")
    c.client = httpx.Client(transport=_mock(routes), timeout=2.0)
    try:
        assert c.fetch("https://example.test/a.html") == "<p>hi</p>"
    finally:
        c.close()


def test_fetch_raises_on_non_2xx():
    c = _Concrete("xx")
    c.client = httpx.Client(transport=_mock({}), timeout=2.0)
    try:
        with pytest.raises(httpx.HTTPStatusError):
            c.fetch("https://example.test/missing.html")
    finally:
        c.close()


# ----- retry behaviour --------------------------------------------------------


class _NoSleep(_Concrete):
    """Subclass with zero retry delay so tests don't hang."""

    retry_initial_delay = 0.0


def test_fetch_retries_transient_503_then_succeeds():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(503, text="busy")
        return httpx.Response(200, text="ok")

    c = _NoSleep("xx")
    c.client = httpx.Client(transport=httpx.MockTransport(handler), timeout=2.0)
    try:
        assert c.fetch("https://example.test/flaky") == "ok"
        assert calls["n"] == 3
    finally:
        c.close()


def test_fetch_gives_up_after_max_retries_on_persistent_503():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(503)

    c = _NoSleep("xx")
    c.client = httpx.Client(transport=httpx.MockTransport(handler), timeout=2.0)
    try:
        with pytest.raises(httpx.HTTPStatusError):
            c.fetch("https://example.test/dead")
        assert calls["n"] == c.max_retries
    finally:
        c.close()


def test_fetch_does_not_retry_on_404():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(404)

    c = _NoSleep("xx")
    c.client = httpx.Client(transport=httpx.MockTransport(handler), timeout=2.0)
    try:
        with pytest.raises(httpx.HTTPStatusError):
            c.fetch("https://example.test/nope")
        assert calls["n"] == 1, "404 must not be retried"
    finally:
        c.close()


def test_fetch_retries_on_transport_error():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 2:
            raise httpx.ConnectError("simulated")
        return httpx.Response(200, text="recovered")

    c = _NoSleep("xx")
    c.client = httpx.Client(transport=httpx.MockTransport(handler), timeout=2.0)
    try:
        assert c.fetch("https://example.test/transport") == "recovered"
        assert calls["n"] == 2
    finally:
        c.close()


def test_follow_frame_chain_walks_two_levels():
    edition = """<frameset><frame name="eAISNavigationBase" src="navbase.html"></frameset>"""
    navbase = """<frameset><frame name="eAISNavigation" src="nav.html"></frameset>"""
    nav = "<div id='AD-2details'>menu</div>"

    routes = {
        "https://eaip.test/edition/index.html": edition,
        "https://eaip.test/edition/navbase.html": navbase,
        "https://eaip.test/edition/nav.html": nav,
    }
    c = _Concrete("xx")
    c.client = httpx.Client(transport=_mock(routes), timeout=2.0)
    try:
        url, html = c.follow_frame_chain(
            "https://eaip.test/edition/index.html",
            ["eAISNavigationBase", "eAISNavigation"],
        )
        assert url == "https://eaip.test/edition/nav.html"
        assert "AD-2details" in html
    finally:
        c.close()
