"""Unit tests for the Ireland crawler's edition resolution (issue: IE onboarding).

AirNav Ireland's AIM landing page lists dated eAIP editions with two URL
shapes - older ones a four-digit year (`2026-05-14-AIRAC`), the newest a
two-digit year (`26-07-09-AIRAC`). These tests cover that both parse and that
the currently-effective edition is picked by date, with a mocked landing page.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers.ie import IE, ROOT_URL


@pytest.fixture
def ie() -> IE:
    crawler = IE()
    yield crawler
    crawler.close()


# The AIM landing page: three editions, mixed two-/four-digit-year URL shapes.
_LANDING = """
<html><body>
<a href="https://www.airnav.ie/AIRAC_MAY_2026/2026-05-14-AIRAC/html/index.html">eAIP 14 MAY 2026</a>
<a href="https://www.airnav.ie/AIRAC_JUNE_2026/2026-06-11-AIRAC/html/index.html">eAIP 11 JUN 2026</a>
<a href="https://www.airnav.ie/AIRAC/26-07-09-AIRAC/html/index.html">eAIP 09 JUL 2026</a>
</body></html>
"""


def test_resolve_edition_picks_latest_in_effect(ie: IE):
    # On 15 JUL the newest (two-digit-year) edition is in effect.
    url = ie._resolve_current_edition_url(
        ROOT_URL, _LANDING, today=datetime.date(2026, 7, 15)
    )
    assert url == "https://www.airnav.ie/AIRAC/26-07-09-AIRAC/html/index.html"


def test_resolve_edition_respects_effective_date(ie: IE):
    # On 20 JUN only the two four-digit-year editions are in effect; pick JUN.
    url = ie._resolve_current_edition_url(
        ROOT_URL, _LANDING, today=datetime.date(2026, 6, 20)
    )
    assert url.endswith("/2026-06-11-AIRAC/html/index.html")


def test_resolve_edition_future_only_falls_back_to_earliest(ie: IE):
    # Before any edition is effective, fall back to the earliest listed one.
    url = ie._resolve_current_edition_url(
        ROOT_URL, _LANDING, today=datetime.date(2026, 1, 1)
    )
    assert url.endswith("/2026-05-14-AIRAC/html/index.html")


def test_resolve_edition_no_links_raises(ie: IE):
    with pytest.raises(ValueError):
        ie._resolve_current_edition_url(
            ROOT_URL, "<html><body>nothing</body></html>"
        )
