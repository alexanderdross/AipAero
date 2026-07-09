"""Importer for embedded aerodrome facts from OurAirports (public domain / CC0).

Downloads the OurAirports CSV exports (airports / runways / frequencies),
filters them to the countries AIP:Aero covers, and POSTs normalized per-ICAO
facts to the website's `/api/airport-facts` ingest endpoint (Bearer auth with the
shared `CRON_SECRET`). The website merges these with OpenAIP at request time.

This is NOT a country crawler (it is not registered in `main.py`); run it
out-of-band, e.g. from a systemd timer alongside the crawlers:

    API_BASE=https://aip.aero API_KEY=<CRON_SECRET> uv run python import_ourairports.py

Data source: https://ourairports.com/data/ (public domain). The stable mirror
URLs are the `davidmegginson.github.io/ourairports-data` CSVs.

Optional address backfill: set `GEOCODE=1` to also reverse-geocode each field's
postal address (street / postcode / phone) from OpenStreetMap (Nominatim) and
persist it, so the website reads the address from D1 instead of geocoding live
on every cold request. Nominatim's usage policy caps this at 1 request/second,
so a full run takes a while - it is opt-in for that reason:

    API_BASE=https://aip.aero API_KEY=<CRON_SECRET> GEOCODE=1 uv run python import_ourairports.py
"""

from __future__ import annotations

import csv
import io
import json
import os
import time
from collections import defaultdict
from urllib.parse import urlparse

import httpx

BASE_CSV = "https://davidmegginson.github.io/ourairports-data"

# OurAirports `iso_country` codes for the countries AIP:Aero covers (UK = GB).
COUNTRIES = {"DE", "AT", "FR", "NL", "GB", "BE", "LU", "CZ", "DK", "GR", "NO", "PL", "SE"}

BATCH_SIZE = 100


def _icao(row: dict[str, str]) -> str | None:
    """Best-effort ICAO for an OurAirports row (prefer icao_code, else a 4-letter ident)."""
    code = (row.get("icao_code") or "").strip().upper()
    if len(code) == 4 and code.isalpha():
        return code
    ident = (row.get("ident") or "").strip().upper()
    if len(ident) == 4 and ident.isalpha():
        return ident
    return None


def _fetch_csv(client: httpx.Client, name: str) -> list[dict[str, str]]:
    resp = client.get(f"{BASE_CSV}/{name}", timeout=60)
    resp.raise_for_status()
    return list(csv.DictReader(io.StringIO(resp.text)))


def build_facts() -> list[dict[str, object]]:
    with httpx.Client(follow_redirects=True) as client:
        airports = _fetch_csv(client, "airports.csv")
        runways = _fetch_csv(client, "runways.csv")
        freqs = _fetch_csv(client, "airport-frequencies.csv")

    # ident (OurAirports airport_ident) -> ICAO, for the airports we keep.
    ident_to_icao: dict[str, str] = {}
    airport_by_icao: dict[str, dict[str, str]] = {}
    for a in airports:
        if a.get("iso_country") not in COUNTRIES:
            continue
        icao = _icao(a)
        if not icao:
            continue
        ident_to_icao[a["ident"]] = icao
        airport_by_icao[icao] = a

    runways_by_icao: dict[str, list[dict]] = defaultdict(list)
    for r in runways:
        icao = ident_to_icao.get(r.get("airport_ident", ""))
        if not icao or (r.get("closed") == "1"):
            continue
        le, he = (r.get("le_ident") or "").strip(), (r.get("he_ident") or "").strip()
        ident = "/".join(x for x in (le, he) if x) or (r.get("le_ident") or "")
        if not ident:
            continue
        runways_by_icao[icao].append(
            {
                "ident": ident,
                "lengthFt": int(r["length_ft"]) if r.get("length_ft", "").isdigit() else None,
                "widthFt": int(r["width_ft"]) if r.get("width_ft", "").isdigit() else None,
                "surface": (r.get("surface") or "").strip() or None,
            }
        )

    freqs_by_icao: dict[str, list[dict]] = defaultdict(list)
    for f in freqs:
        icao = ident_to_icao.get(f.get("airport_ident", ""))
        mhz = (f.get("frequency_mhz") or "").strip()
        if not icao or not mhz:
            continue
        freqs_by_icao[icao].append(
            {
                "type": (f.get("type") or "").strip(),
                "description": (f.get("description") or "").strip() or None,
                "mhz": mhz,
            }
        )

    now = int(time.time())
    facts: list[dict[str, object]] = []
    for icao, a in airport_by_icao.items():
        rwys = runways_by_icao.get(icao, [])
        frqs = freqs_by_icao.get(icao, [])
        lat = a.get("latitude_deg")
        lon = a.get("longitude_deg")
        elev = a.get("elevation_ft")
        # Skip airports we have nothing useful for.
        if not (rwys or frqs or lat or elev):
            continue
        facts.append(
            {
                "icao": icao,
                "lat": float(lat) if lat else None,
                "lon": float(lon) if lon else None,
                "elevationFt": int(elev) if elev and elev.lstrip("-").isdigit() else None,
                "municipality": (a.get("municipality") or "").strip() or None,
                "homeLink": (a.get("home_link") or "").strip() or None,
                "runways": json.dumps(rwys, ensure_ascii=False),
                "frequencies": json.dumps(frqs, ensure_ascii=False),
                # Filled by reverse_geocode() when GEOCODE=1; else left null and
                # the website geocodes live as a fallback.
                "street": None,
                "postcode": None,
                "phone": None,
                "source": "ourairports",
                "updatedAt": now,
            }
        )
    return facts


# OpenStreetMap (Nominatim) reverse-geocode: coordinates -> postal address.
# Mirrors `src/lib/geocode.ts`. Descriptive User-Agent per Nominatim policy.
NOMINATIM = "https://nominatim.openstreetmap.org/reverse"
GEO_UA = "AIP:Aero-importer/1.0 (+https://aip.aero)"


def reverse_geocode(client: httpx.Client, lat: float, lon: float) -> dict[str, str | None]:
    try:
        resp = client.get(
            NOMINATIM,
            params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 18, "addressdetails": 1, "extratags": 1},
            headers={"User-Agent": GEO_UA},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        addr = data.get("address") or {}
        extra = data.get("extratags") or {}
        road = (addr.get("road") or "").strip()
        house = (addr.get("house_number") or "").strip()
        street = " ".join(x for x in (road, house) if x) or None
        return {
            "street": street,
            "postcode": (addr.get("postcode") or "").strip() or None,
            "phone": (extra.get("phone") or extra.get("contact:phone") or "").strip() or None,
        }
    except Exception as exc:  # fail-soft: skip this field's address
        print(f"    geocode failed ({lat},{lon}): {exc}")
        return {"street": None, "postcode": None, "phone": None}


def geocode_facts(facts: list[dict[str, object]]) -> None:
    """Backfill street/postcode/phone in place, respecting Nominatim's 1 req/s."""
    targets = [f for f in facts if f.get("lat") is not None and f.get("lon") is not None]
    print(f"Geocoding {len(targets)} fields (~1/s, Nominatim policy)...")
    with httpx.Client(follow_redirects=True) as client:
        for i, f in enumerate(targets):
            addr = reverse_geocode(client, float(f["lat"]), float(f["lon"]))  # type: ignore[arg-type]
            f.update(addr)
            if (i + 1) % 50 == 0:
                print(f"  geocoded {i + 1}/{len(targets)}")
            time.sleep(1)  # Nominatim: max 1 request/second


def _api_base() -> str:
    """Website origin. Prefer API_BASE; otherwise reuse the crawlers' API_ENDPOINT
    (e.g. https://aip.aero/api/airports) by stripping its path."""
    base = os.environ.get("API_BASE")
    if not base:
        endpoint = os.environ.get("API_ENDPOINT")
        if endpoint:
            u = urlparse(endpoint)
            base = f"{u.scheme}://{u.netloc}"
    return (base or "https://aip.aero").rstrip("/")


def main() -> None:
    api_base = _api_base()
    api_key = os.environ.get("API_KEY") or os.environ.get("CRON_SECRET")
    if not api_key:
        raise SystemExit("Set API_KEY (or CRON_SECRET) to the website's CRON_SECRET.")

    facts = build_facts()
    print(f"Built {len(facts)} airport-facts rows; posting to {api_base}/api/airport-facts")

    if os.environ.get("GEOCODE"):
        geocode_facts(facts)

    url = f"{api_base}/api/airport-facts"
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=60) as client:
        for i in range(0, len(facts), BATCH_SIZE):
            batch = facts[i : i + BATCH_SIZE]
            resp = client.post(url, json=batch, headers=headers)
            resp.raise_for_status()
            print(f"  posted {i + len(batch)}/{len(facts)}")
    print("Done.")


if __name__ == "__main__":
    main()
