"""Unit tests for the Netherlands crawler's edition resolver.

NL.crawl() first has to turn `default.html` into the URL of the current
effective eAIP edition. LVNL names every document with an `-en-GB` locale
suffix, so the entry point is `index-en-GB.html`, not the bare
`index.html`. `_resolve_edition_url` must handle that (the bug that left
the NL airport list empty), plus meta-refresh / JS-redirect fallbacks that
the old Selenium browser used to follow implicitly.
"""

from __future__ import annotations

import pytest

from crawlers.nl import NL

ROOT = "https://eaip.lvnl.nl/web/eaip/default.html"


@pytest.fixture
def nl() -> NL:
    crawler = NL()
    yield crawler
    crawler.close()


# ----- anchor resolution ------------------------------------------------------


def test_locale_suffixed_index_is_matched(nl: NL):
    """The real LVNL case: edition entry is `index-en-GB.html`."""
    html = """<html><body>
      <a href='2025-12-25-AIRAC/html/index-en-GB.html'>Current eAIP</a>
    </body></html>"""
    url = nl._resolve_edition_url(ROOT, html)
    assert url == (
        "https://eaip.lvnl.nl/web/eaip/2025-12-25-AIRAC/html/index-en-GB.html"
    )


def test_bare_index_html_still_matched(nl: NL):
    html = "<a href='2025-12-25-AIRAC/html/index.html'>Current eAIP</a>"
    url = nl._resolve_edition_url(ROOT, html)
    assert url.endswith("/2025-12-25-AIRAC/html/index.html")


def test_query_and_fragment_are_ignored_when_matching(nl: NL):
    html = "<a href='html/index-nl-NL.html?v=2#top'>eAIP</a>"
    url = nl._resolve_edition_url(ROOT, html)
    assert url == "https://eaip.lvnl.nl/web/eaip/html/index-nl-NL.html?v=2#top"


def test_content_pages_do_not_false_match(nl: NL):
    """Section/content pages (`EH-…-en-GB.html`) must not be picked as the
    edition entry — only the first real `index*.html` link."""
    html = """<html><body>
      <a href='EH-Cover Page-en-GB.html'>Cover</a>
      <a href='EH-GEN 0.1-en-GB.html'>GEN</a>
      <a href='html/index-en-GB.html'>Current eAIP</a>
    </body></html>"""
    url = nl._resolve_edition_url(ROOT, html)
    assert url.endswith("/html/index-en-GB.html")


# ----- redirect fallbacks -----------------------------------------------------


def test_meta_refresh_redirect_is_followed(nl: NL):
    html = """<html><head>
      <meta http-equiv="refresh" content="0; url=html/index-en-GB.html">
    </head></html>"""
    url = nl._resolve_edition_url(ROOT, html)
    assert url.endswith("/html/index-en-GB.html")


def test_js_location_redirect_is_followed(nl: NL):
    html = (
        "<html><head><script>window.location.href = "
        "'html/index-en-GB.html';</script></head></html>"
    )
    url = nl._resolve_edition_url(ROOT, html)
    assert url.endswith("/html/index-en-GB.html")


# ----- failure ----------------------------------------------------------------


def test_unresolvable_default_html_raises(nl: NL):
    with pytest.raises(ValueError, match="current-edition"):
        nl._resolve_edition_url(ROOT, "<html><body>nothing here</body></html>")
