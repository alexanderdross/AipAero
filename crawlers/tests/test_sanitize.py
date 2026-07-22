"""Unit tests for the central sanitize/dedup pass (crawlers/sanitize.py)."""

from __future__ import annotations

from crawlers.models import Airport
from sanitize import sanitize_airports


def _ap(icao, title, url="u", country="DE", type_="vfr") -> Airport:
    return Airport(country=country, icao=icao, title=title, url=url, type=type_)


def test_dedupes_by_icao_first_wins():
    rows = [
        _ap("EDDF", "Frankfurt EDDF", url="u1"),
        _ap("eddf", "Frankfurt dup", url="u2"),  # normalizer upper-cases -> dup
        _ap("EDDM", "Munich EDDM", url="u3"),
    ]
    out, rep = sanitize_airports(rows, "DE")
    assert [a.icao for a in out] == ["EDDF", "EDDM"]
    assert out[0].url == "u1"  # first occurrence kept
    assert rep.dropped_duplicates == 1
    assert rep.kept == 2


def test_icao_less_fields_are_kept_and_not_deduped():
    rows = [
        _ap(None, "Some strip"),
        _ap(None, "Another strip"),
    ]
    out, rep = sanitize_airports(rows, "DE")
    assert len(out) == 2
    assert rep.dropped_duplicates == 0
    assert rep.icao_bearing == 0


def test_flags_icao_first_title_but_keeps_it():
    # "EDDF Frankfurt" does NOT end with the ICAO -> flagged, still published.
    rows = [_ap("EDDF", "EDDF Frankfurt")]
    out, rep = sanitize_airports(rows, "DE")
    assert len(out) == 1
    assert rep.bad_title == 1
    assert rep.bad_title_ratio == 1.0


def test_flags_malformed_icao_but_keeps_it():
    rows = [_ap("LOX", "Something LOX")]  # 3 letters
    out, rep = sanitize_airports(rows, "DE")
    assert len(out) == 1
    assert rep.bad_icao == 1


def test_well_formed_title_is_not_flagged():
    rows = [_ap("EDNY", "Friedrichshafen EDNY")]
    _, rep = sanitize_airports(rows, "DE")
    assert rep.bad_title == 0
    assert rep.bad_icao == 0
    assert rep.icao_bearing == 1
