"""Unit tests for the Netherlands crawler's edition resolver.

LVNL's default.html lists several dated AIRAC editions (currently effective
+ next + archived), each linking to `AIRAC AMDT NN-YYYY_YYYY_MM_DD\\index.html`
— note the embedded effective date and the Windows-style backslash separator
(plus spaces). `_resolve_edition_url` must pick the edition in effect today
(the bug that left the airport list empty was picking none / the wrong one),
and normalise the backslash so httpx builds a valid URL. Older single-edition
layouts (bare / locale-suffixed index, meta-refresh / JS redirect) stay
supported as fallbacks.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers.nl import NL

ROOT = "https://eaip.lvnl.nl/web/eaip/default.html"

# Trimmed but faithful copy of the real LVNL default.html: one currently
# effective, two upcoming and three archived editions. Raw string so the
# literal backslashes in the hrefs survive as-is.
LANDING_HTML = r"""
<body>
<div class="FrontPage"><h1>eAIP Issues</h1>
<h2><a href="https://hbs.ixosystem.eu/ixo/login.php">Consult NOTAM</a></h2></div>
<h2>Currently Effective Issue</h2>
<table><tr><th>Effective date</th></tr>
<tr><td style="background-color:#ADFF2F;"><a href="AIRAC AMDT 06-2026_2026_06_11\index.html">11 Jun 2026</a></td></tr>
</table>
<h2>Next Issues</h2>
<table><tr><th>Effective date</th></tr>
<tr><td style="background-color:#FF9999;"><a href="AIRAC AMDT 07-2026_2026_07_09\index.html">09 Jul 2026</a></td></tr>
<tr><td style="background-color:#FF9999;"><a href="AIRAC AMDT 08-2026_2026_08_06\index.html">06 Aug 2026</a></td></tr>
</table>
<h2>Expired Issues (Archives)</h2>
<table><tr><th>Effective date</th></tr>
<tr><td><a href="AIRAC AMDT 05-2026_2026_05_14\index.html">14 May 2026</a></td></tr>
<tr><td><a href="AIRAC AMDT 04-2026_2026_04_16\index.html">16 Apr 2026</a></td></tr>
<tr><td><a href="AIRAC AMDT 03-2026_2026_03_19\index.html">19 Mar 2026</a></td></tr>
</table>
</body>
"""


@pytest.fixture
def nl() -> NL:
    crawler = NL()
    yield crawler
    crawler.close()


# ----- date-based selection ---------------------------------------------------


def test_picks_currently_effective_before_next_cycle(nl: NL):
    # 08 JUL 2026: AIRAC 07 (eff 09 JUL) is not yet effective, and the archived
    # editions are older, so the current edition is AIRAC 06 (eff 11 JUN).
    url = nl._resolve_edition_url(ROOT, LANDING_HTML, today=datetime.date(2026, 7, 8))
    assert "AIRAC AMDT 06-2026_2026_06_11/index.html" in url


def test_switches_on_effective_date(nl: NL):
    url = nl._resolve_edition_url(ROOT, LANDING_HTML, today=datetime.date(2026, 7, 9))
    assert "2026_07_09/index.html" in url


def test_later_within_cycle_stays_current(nl: NL):
    url = nl._resolve_edition_url(ROOT, LANDING_HTML, today=datetime.date(2026, 8, 3))
    assert "2026_07_09/index.html" in url


def test_backslash_is_normalised_and_url_absolute(nl: NL):
    url = nl._resolve_edition_url(ROOT, LANDING_HTML, today=datetime.date(2026, 7, 8))
    assert "\\" not in url
    assert url.startswith("https://eaip.lvnl.nl/web/eaip/")


def test_archived_editions_do_not_win_over_current(nl: NL):
    # Even though all archives are <= today, the newest in-effect edition wins.
    url = nl._resolve_edition_url(ROOT, LANDING_HTML, today=datetime.date(2026, 7, 8))
    assert "05-2026" not in url and "04-2026" not in url and "03-2026" not in url


def test_all_editions_future_falls_back_to_earliest(nl: NL):
    url = nl._resolve_edition_url(ROOT, LANDING_HTML, today=datetime.date(2026, 1, 1))
    assert "2026_03_19/index.html" in url


def test_notam_link_without_date_is_ignored(nl: NL):
    # The NOTAM link carries no AIRAC date and must never be chosen.
    url = nl._resolve_edition_url(ROOT, LANDING_HTML, today=datetime.date(2026, 7, 8))
    assert "ixosystem" not in url


# ----- single-edition / redirect fallbacks ------------------------------------


def test_fallback_locale_suffixed_index(nl: NL):
    html = "<a href='html/index-en-GB.html'>Current eAIP</a>"
    url = nl._resolve_edition_url(ROOT, html, today=datetime.date(2026, 7, 8))
    assert url.endswith("/html/index-en-GB.html")


def test_fallback_meta_refresh_redirect(nl: NL):
    html = (
        '<meta http-equiv="refresh" content="0; url=html/index-en-GB.html">'
    )
    url = nl._resolve_edition_url(ROOT, html, today=datetime.date(2026, 7, 8))
    assert url.endswith("/html/index-en-GB.html")


def test_fallback_js_location_redirect(nl: NL):
    html = "<script>window.location.href = 'html/index-en-GB.html';</script>"
    url = nl._resolve_edition_url(ROOT, html, today=datetime.date(2026, 7, 8))
    assert url.endswith("/html/index-en-GB.html")


def test_unresolvable_default_html_raises(nl: NL):
    with pytest.raises(ValueError, match="current-edition"):
        nl._resolve_edition_url(
            ROOT, "<html><body>nothing</body></html>", today=datetime.date(2026, 7, 8)
        )
