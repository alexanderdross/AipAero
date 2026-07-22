"""Unit tests for the Airport model's non-rejecting normalizers."""

from __future__ import annotations

from crawlers.models import Airport


def test_icao_is_uppercased_and_stripped():
    a = Airport(country="de", icao="  ednY ", title="X EDNY", url="u", type="vfr")
    assert a.icao == "EDNY"


def test_empty_icao_becomes_none():
    a = Airport(country="DE", icao="   ", title="Name only", url="u", type="vfr")
    assert a.icao is None


def test_none_icao_stays_none():
    a = Airport(country="DE", icao=None, title="Name only", url="u", type="vfr")
    assert a.icao is None


def test_country_is_uppercased_and_stripped():
    a = Airport(country=" de ", icao="EDDF", title="Frankfurt EDDF", url="u", type="vfr")
    assert a.country == "DE"


def test_title_and_url_are_stripped():
    a = Airport(
        country="DE",
        icao="EDDF",
        title="  Frankfurt EDDF  ",
        url="  http://x  ",
        type="vfr",
    )
    assert a.title == "Frankfurt EDDF"
    assert a.url == "http://x"
