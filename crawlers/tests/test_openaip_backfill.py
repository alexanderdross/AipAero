"""Unit tests for the OpenAIP coord-backfill mapping.

Mirrors the cases in the website's openaip parser (src/lib/openaip-parse.ts):
coordinates are [lon, lat], elevation converts metres/feet by unit, runways and
frequencies map their integer enums, and a coord-less item yields no row.
"""

from __future__ import annotations

from import_openaip_backfill import build_row, map_openaip_item


def test_maps_coords_elevation_runways_frequencies() -> None:
    item = {
        "icaoCode": "LOWX",
        "geometry": {"type": "Point", "coordinates": [13.5, 47.8]},
        "elevation": {"value": 100, "unit": 0},  # metres
        "runways": [
            {
                "designator": "09/27",
                "dimension": {
                    "length": {"value": 1200, "unit": 0},
                    "width": {"value": 30, "unit": 0},
                },
                "surface": {"mainComposite": 2},  # Grass
                "turnDirection": 1,  # Left
            }
        ],
        "frequencies": [
            {"value": "119.400", "name": "TOWER", "type": 14},
            {"value": "122.100", "type": 10},  # Information (no name)
        ],
    }
    facts = map_openaip_item(item)
    assert facts["lat"] == 47.8
    assert facts["lon"] == 13.5
    assert facts["elevationFt"] == round(100 * 3.28084)
    assert facts["runways"] == [
        {
            "ident": "09/27",
            "lengthFt": round(1200 * 3.28084),
            "widthFt": round(30 * 3.28084),
            "surface": "Grass",
            "trafficPattern": "left",
        }
    ]
    assert facts["frequencies"] == [
        {"type": "TOWER", "description": "TOWER", "mhz": "119.400"},
        {"type": "Information", "description": None, "mhz": "122.100"},
    ]


def test_elevation_in_feet_is_not_reconverted() -> None:
    facts = map_openaip_item({"elevation": {"value": 330, "unit": 1}})
    assert facts["elevationFt"] == 330


def test_build_row_skips_a_field_without_coordinates() -> None:
    # No geometry -> no coords -> no row (stays "missing", retried next run).
    assert build_row("LFXX", {"icaoCode": "LFXX"}, now=1_700_000_000) is None


def test_build_row_shapes_the_api_payload() -> None:
    item = {
        "geometry": {"coordinates": [7.0, 51.0]},
        "elevation": {"value": 50, "unit": 1},
        "runways": [],
        "frequencies": [],
    }
    row = build_row("EDXX", item, now=1_700_000_000)
    assert row == {
        "icao": "EDXX",
        "lat": 51.0,
        "lon": 7.0,
        "elevationFt": 50,
        "runways": None,  # empty list -> null, not "[]"
        "frequencies": None,
        "hoursStructured": None,  # no hoursOfOperation in this item
        "hoursSource": None,
        "source": "openaip-backfill",
        "updatedAt": 1_700_000_000,
    }


def test_build_row_carries_openaip_hours() -> None:
    item = {
        "geometry": {"coordinates": [7.0, 51.0]},
        "hoursOfOperation": {
            "operatingHours": [
                {"dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00"},
            ]
        },
    }
    row = build_row("EDXX", item, now=1_700_000_000)
    assert row is not None
    assert row["hoursSource"] == "openaip"
    assert '"kind":"window"' in row["hoursStructured"]


def test_ambiguous_turn_direction_yields_no_circuit() -> None:
    facts = map_openaip_item(
        {"runways": [{"designator": "18/36", "turnDirection": 2}]}  # Both
    )
    assert facts["runways"][0]["trafficPattern"] is None
