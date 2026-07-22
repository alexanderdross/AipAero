"""Unit tests for the Iceland crawler: name folding/dedupe + edition picker."""

from __future__ import annotations

import datetime

import pytest

from crawlers.is_ import IS, _dedupe_native_ascii, _fold

# Trimmed Isavia landing page: three dated edition folders.
LANDING = """
<a href="A_05-2026_2026_05_14/">14 May 2026</a>
<a href="A_06-2026_2026_06_11/">11 Jun 2026</a>
<a href="A_07-2026_2026_07_09/">09 Jul 2026</a>
<a href="about.html">About</a>
"""


@pytest.fixture
def crawler() -> IS:
    c = IS()
    yield c
    c.close()


# ----- _fold (module-level, pure) --------------------------------------------


def test_fold_transliterates_icelandic_letters():
    assert _fold("GRUNDARFJÖRÐUR") == "GRUNDARFJORDUR"
    assert _fold("Þórshöfn") == "THORSHOFN"


# ----- _dedupe_native_ascii (module-level, pure) -----------------------------


def test_dedupe_collapses_ascii_twin():
    assert _dedupe_native_ascii("AKUREYRI - AKUREYRI") == "AKUREYRI"
    assert _dedupe_native_ascii("BÍLDUDALUR - BILDUDALUR") == "BÍLDUDALUR"


def test_dedupe_collapses_when_ascii_drops_a_word():
    assert (
        _dedupe_native_ascii("HÖFN Í HORNAFIRÐI - HOFN HORNAFIRDI")
        == "HÖFN Í HORNAFIRÐI"
    )


def test_dedupe_keeps_genuinely_two_part_name():
    # The ASCII half carries a distinct word -> not a transliteration, keep both.
    assert _dedupe_native_ascii("REYKJAVIK - KEFLAVIK") == "REYKJAVIK - KEFLAVIK"


def test_dedupe_no_separator_is_untouched():
    assert _dedupe_native_ascii("EGILSSTADIR") == "EGILSSTADIR"


# ----- edition folder resolution ---------------------------------------------


def test_picks_current_edition_before_next_cycle(crawler: IS):
    folder = crawler._resolve_edition_folder(LANDING, today=datetime.date(2026, 7, 8))
    assert "2026_06_11" in folder


def test_switches_on_effective_date(crawler: IS):
    folder = crawler._resolve_edition_folder(LANDING, today=datetime.date(2026, 7, 9))
    assert "2026_07_09" in folder


def test_all_future_falls_back_to_earliest(crawler: IS):
    folder = crawler._resolve_edition_folder(LANDING, today=datetime.date(2026, 1, 1))
    assert "2026_05_14" in folder


def test_no_edition_folders_raises(crawler: IS):
    with pytest.raises(ValueError):
        crawler._resolve_edition_folder(
            "<a href='about.html'>x</a>", today=datetime.date(2026, 7, 8)
        )
