"""Unit tests for the Bosnia and Herzegovina crawler (BHANSA eurocontrol eAIP).

The BHANSA edition lives at a deterministic date-stamped path
(`<YYYY-MM-DD>-AIRAC/html/index.html`), so the crawler builds the current
edition URL straight from the fixed 28-day AIRAC schedule instead of scraping
the JS root page. These tests cover the AIRAC date maths and the edition-index
URL construction (no network - the live fetch is exercised by the live test).
"""

from __future__ import annotations

import datetime

import pytest

from crawlers import ba as ba_module
from crawlers.ba import BA


@pytest.fixture
def ba() -> BA:
    crawler = BA()
    yield crawler
    crawler.close()


def test_module_host_is_bhansa():
    assert ba_module.HOST == "https://eaip.bhansa.gov.ba/"


def test_airac_dates_follow_28day_cycle(ba: BA):
    # Newest-first AIRAC effective dates on/before 15 JUL 2026.
    ds = BA.airac_dates_on_or_before(datetime.date(2026, 7, 15), 3)
    assert ds == [
        datetime.date(2026, 7, 9),
        datetime.date(2026, 6, 11),
        datetime.date(2026, 5, 14),
    ]


def test_airac_dates_on_boundary(ba: BA):
    # Exactly on an effective date, that date is the newest.
    ds = BA.airac_dates_on_or_before(datetime.date(2026, 7, 9), 2)
    assert ds == [datetime.date(2026, 7, 9), datetime.date(2026, 6, 11)]


def test_resolve_edition_index_builds_dated_path(ba: BA, monkeypatch):
    # The first probed cycle (newest) that answers 200 wins; here the newest.
    probed: list[str] = []

    def _fake_fetch(url: str):
        probed.append(url)
        return "<html>ok</html>"

    monkeypatch.setattr(ba, "fetch", _fake_fetch)
    url = ba._resolve_edition_index(today=datetime.date(2026, 7, 15))
    assert url == (
        "https://eaip.bhansa.gov.ba/2026-07-09-AIRAC/html/index.html"
    )
    assert probed == [url]


def test_resolve_edition_index_falls_back_to_older_cycle(ba: BA, monkeypatch):
    # Newest cycle 404s, the previous one answers.
    def _fake_fetch(url: str):
        if "2026-07-09" in url:
            raise ValueError("404")
        return "<html>ok</html>"

    monkeypatch.setattr(ba, "fetch", _fake_fetch)
    url = ba._resolve_edition_index(today=datetime.date(2026, 7, 15))
    assert url == (
        "https://eaip.bhansa.gov.ba/2026-06-11-AIRAC/html/index.html"
    )


def test_resolve_edition_index_all_miss_raises(ba: BA, monkeypatch):
    monkeypatch.setattr(
        ba, "fetch", lambda url: (_ for _ in ()).throw(ValueError("404"))
    )
    with pytest.raises(ValueError):
        ba._resolve_edition_index(today=datetime.date(2026, 7, 15))
