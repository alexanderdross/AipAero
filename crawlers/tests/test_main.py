"""Unit tests for the crawler entry point's country selection.

`main.py` runs every active crawler by default, or a subset when country
codes are passed on the command line (e.g. `uv run main.py NL UK`).
"""

from __future__ import annotations

import pytest

import main


def _close(crawlers) -> None:
    for c in crawlers:
        c.close()


def test_default_selects_all_five():
    crawlers = main.select_crawlers()
    try:
        assert sorted(c.country for c in crawlers) == ["AT", "DE", "FR", "NL", "UK"]
    finally:
        _close(crawlers)


def test_none_selects_all_five():
    crawlers = main.select_crawlers(None)
    try:
        assert sorted(c.country for c in crawlers) == ["AT", "DE", "FR", "NL", "UK"]
    finally:
        _close(crawlers)


def test_subset_selection_is_case_insensitive():
    crawlers = main.select_crawlers(["nl", "UK"])
    try:
        assert sorted(c.country for c in crawlers) == ["NL", "UK"]
    finally:
        _close(crawlers)


def test_selection_preserves_requested_order():
    crawlers = main.select_crawlers(["UK", "NL"])
    try:
        assert [c.country for c in crawlers] == ["UK", "NL"]
    finally:
        _close(crawlers)


def test_unknown_country_aborts():
    with pytest.raises(SystemExit, match="Unknown country"):
        main.select_crawlers(["NL", "XX"])
