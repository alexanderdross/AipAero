"""Unit tests for the Slovakia crawler's edition resolution (SK onboarding).

The SK AIP-SR page links two eAIP framesets - "Currently Effective" and "Next
Issue". These tests cover that the crawler picks the Currently Effective one by
its anchor text (not by the fragile ddMMMyyyy URL date), with a mocked page.
"""

from __future__ import annotations

import pytest

from crawlers.sk import SK, AIP_INDEX_URL


@pytest.fixture
def sk() -> SK:
    crawler = SK()
    yield crawler
    crawler.close()


# The AIP SR page: two frameset links, the effective one carrying `_amdt`.
_AIP_SR = """
<html><body>
<a href="index.php?fn=205&publ_type=6&lng=en">AD</a>
<a href="https://aim.lps.sk/web/eAIP_SR/AIP_SR_EFF_09JUL2026_amdt/html/LZ-frameset-en-SK.html">Currently Effective</a>
<a href="https://aim.lps.sk/web/eAIP_SR/AIP_SR_EFF_06AUG2026/html/LZ-frameset-en-SK.html">Next Issue</a>
</body></html>
"""


def test_resolve_effective_picks_currently_effective(sk: SK):
    url = sk._resolve_effective_frameset(AIP_INDEX_URL, _AIP_SR)
    assert url == (
        "https://aim.lps.sk/web/eAIP_SR/AIP_SR_EFF_09JUL2026_amdt/"
        "html/LZ-frameset-en-SK.html"
    )


def test_resolve_effective_falls_back_to_first_frameset(sk: SK):
    # No labelled link - fall back to the first frameset href found.
    html = """
    <html><body>
    <a href="https://aim.lps.sk/web/eAIP_SR/AIP_SR_EFF_09JUL2026/html/LZ-frameset-en-SK.html">eAIP</a>
    </body></html>
    """
    url = sk._resolve_effective_frameset(AIP_INDEX_URL, html)
    assert url.endswith("/AIP_SR_EFF_09JUL2026/html/LZ-frameset-en-SK.html")


def test_resolve_effective_no_frameset_raises(sk: SK):
    with pytest.raises(ValueError):
        sk._resolve_effective_frameset(
            AIP_INDEX_URL, "<html><body>nothing</body></html>"
        )
