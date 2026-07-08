"""Unit tests for the UK crawler's AIRAC edition selector.

The NATS publications landing page lists several AIRAC editions at once
(current + next 28/56-day AMDTs) with no "current" label. Each online
version embeds its AIRAC effective date in the URL
(`.../YYYY-MM-DD-AIRAC/html/index-en-GB.html`).
`_resolve_current_edition_url` must pick the latest edition already in
effect on a given day, and ignore the PDF / AMDT download links.
"""

from __future__ import annotations

import datetime

import pytest

from crawlers.uk import UK, ROOT_URL

# Trimmed but structurally faithful copy of the real landing-page markup:
# three AIRAC editions (06/07/08 2026) plus a 28-day AMDT download card.
LANDING_HTML = """
<div class="col-lg-4"><div class="container_white">
  <h3>AIRAC 06/2026</h3><h6>11 JUNE 2026</h6>
  <p>
    <a href="https://www.aurora.nats.co.uk/htmlAIP/Publications/2026-06-11-AIRAC/html/index-en-GB.html">Online Version</a>
    <a href="/cms-nats/export/sites/default/en/Publications/AIP/PDF_AIP/EG-aip-en-11-06-2026.pdf">Offline PDF Download</a>
    <a href="/cms-nats/export/sites/default/en/Publications/AIP/HTML_AIP/AIRAC-06-26.zip">Offline HTML Download</a>
  </p>
</div></div>
<div class="col-lg-4"><div class="container_white">
  <h3>AIRAC 07/2026</h3><h6>09 JULY 2026</h6>
  <p><a href="https://www.aurora.nats.co.uk/htmlAIP/Publications/2026-07-09-AIRAC/html/index-en-GB.html">Online Version</a></p>
</div></div>
<div class="col-lg-4"><div class="container_white">
  <h3>AIRAC 08/2026</h3><h6>06 AUGUST 2026</h6>
  <p><a href="https://www.aurora.nats.co.uk/htmlAIP/Publications/2026-08-06-AIRAC/html/index-en-GB.html">Online Version</a></p>
</div></div>
<div class="col-lg-4"><div class="container_white">
  <h3>AIRAC 07/2026</h3><h6>09 JULY 2026</h6>
  <p><a href="/cms-nats/export/sites/default/en/Publications/AIP/AMDT/28day-07-26.zip">28 Day AMDT Download</a></p>
</div></div>
"""


@pytest.fixture
def uk() -> UK:
    crawler = UK()
    yield crawler
    crawler.close()


def test_picks_current_edition_before_next_cycle(uk: UK):
    # 08 JUL 2026: AIRAC 07 (eff 09 JUL) is not yet in effect, so the current
    # edition is still AIRAC 06 (eff 11 JUN).
    url = uk._resolve_current_edition_url(
        ROOT_URL, LANDING_HTML, today=datetime.date(2026, 7, 8)
    )
    assert "2026-06-11-AIRAC" in url


def test_switches_on_effective_date(uk: UK):
    # 09 JUL 2026: AIRAC 07 becomes effective exactly today.
    url = uk._resolve_current_edition_url(
        ROOT_URL, LANDING_HTML, today=datetime.date(2026, 7, 9)
    )
    assert "2026-07-09-AIRAC" in url


def test_later_within_cycle_stays_current(uk: UK):
    url = uk._resolve_current_edition_url(
        ROOT_URL, LANDING_HTML, today=datetime.date(2026, 7, 20)
    )
    assert "2026-07-09-AIRAC" in url


def test_pdf_and_amdt_links_are_ignored(uk: UK):
    html = (
        '<a href="/x/HTML_AIP/AIRAC-06-26.zip">Offline HTML Download</a>'
        '<a href="/x/PDF_AIP/EG-aip-en-11-06-2026.pdf">Offline PDF Download</a>'
        '<a href="/x/AMDT/28day-07-26.zip">28 Day AMDT Download</a>'
    )
    with pytest.raises(ValueError, match="Online Version"):
        uk._resolve_current_edition_url(
            ROOT_URL, html, today=datetime.date(2026, 7, 8)
        )


def test_all_editions_future_falls_back_to_earliest(uk: UK):
    url = uk._resolve_current_edition_url(
        ROOT_URL, LANDING_HTML, today=datetime.date(2026, 1, 1)
    )
    assert "2026-06-11-AIRAC" in url


def test_returned_url_is_absolute(uk: UK):
    url = uk._resolve_current_edition_url(
        ROOT_URL, LANDING_HTML, today=datetime.date(2026, 7, 8)
    )
    assert url.startswith("https://www.aurora.nats.co.uk/")
