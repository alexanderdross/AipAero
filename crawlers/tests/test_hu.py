"""Unit tests for the Hungary crawler's dated-edition folder picker."""

from __future__ import annotations

import datetime

import pytest

from crawlers.hu import HU

LANDING = """
<a href="2026-05-14/">14 MAY 2026</a>
<a href="2026-06-11/">11 JUN 2026</a>
<a href="2026-07-09/">09 JUL 2026</a>
<a href="eaip.zip">Download</a>
"""


@pytest.fixture
def crawler() -> HU:
    c = HU()
    yield c
    c.close()


def test_picks_current_before_next_cycle(crawler: HU):
    folder = crawler._resolve_edition_folder(LANDING, today=datetime.date(2026, 7, 8))
    assert folder.rstrip("/").endswith("2026-06-11")


def test_switches_on_effective_date(crawler: HU):
    folder = crawler._resolve_edition_folder(LANDING, today=datetime.date(2026, 7, 9))
    assert folder.rstrip("/").endswith("2026-07-09")


def test_all_future_falls_back_to_earliest(crawler: HU):
    folder = crawler._resolve_edition_folder(LANDING, today=datetime.date(2026, 1, 1))
    assert folder.rstrip("/").endswith("2026-05-14")


def test_returned_folder_is_absolute(crawler: HU):
    folder = crawler._resolve_edition_folder(LANDING, today=datetime.date(2026, 7, 8))
    assert folder.startswith("https://ais-en.hungarocontrol.hu/aip/")


def test_no_dated_folders_raises(crawler: HU):
    with pytest.raises(ValueError):
        crawler._resolve_edition_folder(
            "<a href='eaip.zip'>x</a>", today=datetime.date(2026, 7, 8)
        )
