"""OpenAIP coordinate backfill for AIP fields OurAirports never carried.

The weekly OurAirports importer (`import_ourairports.py`) is the base source of
the `airport_facts` table, but OurAirports does not carry hospital heliports or
many small ULM / private strips. Those fields therefore have no persisted
`airport_facts` row, so they are absent from the "airports near me" map and
carry no persisted geo (the detail page still works via the website's live
OpenAIP / AWC fallback, but the map only reads the persisted table).

This backfill closes that gap WITHOUT re-querying OpenAIP for all ~3k fields:

  1. GET `/api/airport-facts` (Bearer CRON_SECRET) -> the ICAOs that have no
     facts row yet (server-side `QUERIES.airportsMissingFacts`).
  2. For each, query OpenAIP core (`?search=<ICAO>&limit=1`, `x-openaip-api-key`)
     and map coordinates / elevation / runways / frequencies the same way the
     website's `src/lib/openaip-parse.ts` does.
  3. POST the rows that resolved to coordinates back to `/api/airport-facts`.

DRY-RUN BY DEFAULT: it prints what it would post and writes nothing. Set
`BACKFILL_APPLY=1` to actually POST. Fields OpenAIP has no coordinates for are
left untouched, so they stay "missing" and are retried on the next run (or
self-heal via the website's on-read write-back when someone visits them).

    API_BASE=https://aip.aero API_KEY=<CRON_SECRET> OPENAIP_API_KEY=<key> \
        uv run python import_openaip_backfill.py            # dry-run
    API_BASE=https://aip.aero API_KEY=<CRON_SECRET> OPENAIP_API_KEY=<key> \
        BACKFILL_APPLY=1 uv run python import_openaip_backfill.py   # apply
"""

from __future__ import annotations

import json
import os
import time
from urllib.parse import urlparse

import httpx

OPENAIP_API = "https://api.core.openaip.net/api/airports"
BATCH_SIZE = 100  # rows per POST, same as import_ourairports.py
REQUEST_DELAY_S = 0.2  # polite pacing between OpenAIP lookups
SOURCE = "openaip-backfill"
M_TO_FT = 3.28084

# --- OpenAIP integer enums -> labels (authoritative airport schema, mirrored
# from src/lib/openaip-parse.ts; keep the two in sync). ------------------------
_SURFACE = {
    0: "Asphalt", 1: "Concrete", 2: "Grass", 3: "Sand", 4: "Water",
    5: "Bituminous", 6: "Brick", 7: "Macadam", 8: "Stone", 9: "Coral",
    10: "Clay", 11: "Laterite", 12: "Gravel", 13: "Earth", 14: "Ice",
    15: "Snow", 17: "Metal", 20: "Wood", 22: "Unknown",
}
_FREQ_TYPE = {
    0: "Approach", 1: "Apron", 2: "Arrival", 3: "Center", 4: "CTAF",
    5: "Delivery", 6: "Departure", 7: "FIS", 8: "Gliding", 9: "Ground",
    10: "Information", 11: "Multicom", 12: "Unicom", 13: "Radar", 14: "Tower",
    15: "ATIS", 16: "Radio", 17: "Other", 19: "AWOS", 22: "AFIS",
    25: "Emergency", 26: "Clearance Delivery",
}


def _num(v: object) -> float | None:
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _to_feet(value: float | None, unit: object) -> int | None:
    """OpenAIP value in its unit (0 = metres, 1 = feet) -> integer feet."""
    if value is None:
        return None
    return round(value) if unit == 1 else round(value * M_TO_FT)


def _turn_direction(v: object) -> str | None:
    # Safety-relevant: only the two unambiguous single-direction codes.
    if v == 0:
        return "right"
    if v == 1:
        return "left"
    return None


def _parse_runways(raw: object) -> list[dict[str, object | None]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, object | None]] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        designator = r.get("designator")
        if not isinstance(designator, str) or not designator:
            continue
        dim = r.get("dimension") if isinstance(r.get("dimension"), dict) else {}
        length = dim.get("length") if isinstance(dim.get("length"), dict) else None
        width = dim.get("width") if isinstance(dim.get("width"), dict) else None
        surface_obj = r.get("surface") if isinstance(r.get("surface"), dict) else {}
        surface_code = surface_obj.get("mainComposite")
        out.append(
            {
                "ident": designator,
                "lengthFt": _to_feet(_num(length.get("value")), length.get("unit"))
                if length
                else None,
                "widthFt": _to_feet(_num(width.get("value")), width.get("unit"))
                if width
                else None,
                "surface": _SURFACE.get(surface_code)
                if isinstance(surface_code, int)
                else None,
                "trafficPattern": _turn_direction(r.get("turnDirection")),
            }
        )
    return out


def _parse_frequencies(raw: object) -> list[dict[str, object | None]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, object | None]] = []
    for f in raw:
        if not isinstance(f, dict):
            continue
        mhz = f.get("value")
        if not isinstance(mhz, str) or not mhz:
            continue
        name = f.get("name") if isinstance(f.get("name"), str) else None
        ftype = f.get("type")
        type_label = name or (
            _FREQ_TYPE.get(ftype, "") if isinstance(ftype, int) else ""
        )
        out.append({"type": type_label, "description": name, "mhz": mhz})
    return out


def map_openaip_item(item: dict[str, object]) -> dict[str, object | None]:
    """Coordinates / elevation / runways / frequencies from a raw OpenAIP
    airport item, mirroring src/lib/openaip-parse.ts (coords are [lon, lat])."""
    geometry = item.get("geometry")
    coords = geometry.get("coordinates") if isinstance(geometry, dict) else None
    elev = item.get("elevation") if isinstance(item.get("elevation"), dict) else None
    lat = _num(coords[1]) if isinstance(coords, list) and len(coords) >= 2 else None
    lon = _num(coords[0]) if isinstance(coords, list) and len(coords) >= 2 else None
    return {
        "lat": lat,
        "lon": lon,
        "elevationFt": _to_feet(_num(elev.get("value")), elev.get("unit"))
        if elev
        else None,
        "runways": _parse_runways(item.get("runways")),
        "frequencies": _parse_frequencies(item.get("frequencies")),
    }


def _api_base() -> str:
    """Website origin. Prefer API_BASE; else strip the crawlers' API_ENDPOINT."""
    base = os.environ.get("API_BASE")
    if not base:
        endpoint = os.environ.get("API_ENDPOINT")
        if endpoint:
            u = urlparse(endpoint)
            base = f"{u.scheme}://{u.netloc}"
    return (base or "https://aip.aero").rstrip("/")


def fetch_missing(client: httpx.Client, api_base: str, api_key: str) -> list[dict]:
    """The ICAOs with no facts row yet (server-side `airportsMissingFacts`)."""
    resp = client.get(
        f"{api_base}/api/airport-facts",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    missing = data.get("missing", []) if isinstance(data, dict) else []
    return [m for m in missing if isinstance(m, dict) and m.get("icao")]


def lookup_openaip(
    client: httpx.Client, icao: str, key: str
) -> dict[str, object] | None:
    """The OpenAIP airport item whose `icaoCode` matches, or None (fail-soft)."""
    try:
        resp = client.get(
            OPENAIP_API,
            params={"search": icao, "limit": 1},
            headers={"x-openaip-api-key": key},
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        items = payload.get("items") if isinstance(payload, dict) else None
        item = items[0] if isinstance(items, list) and items else None
        if isinstance(item, dict) and item.get("icaoCode") == icao:
            return item
    except Exception as exc:  # one bad lookup must not abort the run
        print(f"  [warn] OpenAIP lookup failed for {icao}: {exc}")
    return None


def build_row(icao: str, item: dict[str, object], now: int) -> dict[str, object] | None:
    """A `/api/airport-facts` row from an OpenAIP item, or None when it has no
    coordinates (a coord-less row would not help the map, so skip and retry)."""
    facts = map_openaip_item(item)
    if facts["lat"] is None or facts["lon"] is None:
        return None
    return {
        "icao": icao,
        "lat": facts["lat"],
        "lon": facts["lon"],
        "elevationFt": facts["elevationFt"],
        "runways": json.dumps(facts["runways"]) if facts["runways"] else None,
        "frequencies": json.dumps(facts["frequencies"])
        if facts["frequencies"]
        else None,
        "source": SOURCE,
        "updatedAt": now,
    }


def main() -> None:
    api_base = _api_base()
    api_key = os.environ.get("API_KEY") or os.environ.get("CRON_SECRET")
    if not api_key:
        raise SystemExit("Set API_KEY (or CRON_SECRET) to the website's CRON_SECRET.")
    openaip_key = os.environ.get("OPENAIP_API_KEY")
    if not openaip_key:
        raise SystemExit("Set OPENAIP_API_KEY to your OpenAIP core API key.")
    apply = bool(os.environ.get("BACKFILL_APPLY"))
    # Fixed timestamp for the whole run (unix seconds); avoids per-row drift.
    now = int(time.time())

    # Optional explicit ICAO list (space/comma-separated) for a targeted
    # re-run, bypassing the /api/airport-facts missing-list lookup - also the
    # way to validate the OpenAIP key before the endpoint is deployed.
    explicit = [
        i.upper()
        for i in os.environ.get("BACKFILL_ICAOS", "").replace(",", " ").split()
    ]

    with httpx.Client(follow_redirects=True) as client:
        if explicit:
            missing = [{"icao": i, "country": "??"} for i in explicit]
            print(f"{len(missing)} explicit ICAO(s); querying OpenAIP...")
        else:
            missing = fetch_missing(client, api_base, api_key)
            print(f"{len(missing)} field(s) without a facts row; querying OpenAIP...")

        rows: list[dict[str, object]] = []
        no_coords: list[str] = []
        for i, m in enumerate(missing):
            icao = m["icao"]
            item = lookup_openaip(client, icao, openaip_key)
            row = build_row(icao, item, now) if item else None
            if row:
                rows.append(row)
                print(
                    f"  {icao} ({m.get('country', '??')}): "
                    f"lat={row['lat']:.5f} lon={row['lon']:.5f} "
                    f"elev={row['elevationFt']} "
                    f"rwy={len(json.loads(row['runways'])) if row['runways'] else 0} "
                    f"freq={len(json.loads(row['frequencies'])) if row['frequencies'] else 0}"
                )
            else:
                no_coords.append(icao)
            if REQUEST_DELAY_S:
                time.sleep(REQUEST_DELAY_S)

        print(
            f"\nResolved coordinates for {len(rows)}/{len(missing)}; "
            f"{len(no_coords)} not found in OpenAIP: {', '.join(no_coords) or '-'}"
        )

        if not apply:
            print("\nDRY-RUN (set BACKFILL_APPLY=1 to POST). No data written.")
            return
        if not rows:
            print("\nNothing to POST.")
            return

        url = f"{api_base}/api/airport-facts"
        headers = {"Authorization": f"Bearer {api_key}"}
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i : i + BATCH_SIZE]
            resp = client.post(url, json=batch, headers=headers, timeout=60)
            resp.raise_for_status()
            print(f"  posted {i + len(batch)}/{len(rows)}")
        print("Done.")


if __name__ == "__main__":
    main()
