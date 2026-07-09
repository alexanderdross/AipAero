import "server-only";

import { getAwcAirport } from "~/lib/awc-airport";
import { getOpenAipFacts } from "~/lib/openaip";
import { QUERIES } from "~/server/db/queries";
import type {
  AirportFactsRow,
  FrequencyFact,
  RunwayFact,
} from "~/server/db/schema";

// Source-agnostic aerodrome facts rendered by `AirportFacts`, merged from three
// sources (see `getAirportFacts` for the precedence):
//   1. OpenAIP     - richest; the only source of fuel / PPR / opening hours /
//                    circuit direction. Needs `OPENAIP_API_KEY`.
//   2. OurAirports - public-domain base (D1, via the importer); the only source
//                    of town + official website.
//   3. AWC (NOAA)  - the free, no-key, no-importer "airport" endpoint; a reliable
//                    always-on fallback for coordinates / elevation / runways /
//                    frequencies, so the card works out of the box.
// The postal address (street/phone) is layered on separately from OpenStreetMap
// (see `~/lib/geocode`), keyed by coordinates, in the gadgets wrapper.
export interface NormalizedFacts {
  lat: number | null;
  lon: number | null;
  elevationFt: number | null;
  municipality: string | null; // town/city (OurAirports)
  homeLink: string | null; // official airport website (OurAirports)
  ppr: boolean | null; // prior permission required (OpenAIP, best-effort)
  fuel: string[]; // available fuel types (OpenAIP, best-effort)
  openingHours: string | null; // hours of operation (OpenAIP, best-effort)
  runways: RunwayFact[];
  frequencies: FrequencyFact[];
  source: string; // provenance, e.g. "openaip" or "ourairports"
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function rowToFacts(row: AirportFactsRow): NormalizedFacts {
  return {
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    elevationFt: row.elevationFt ?? null,
    municipality: row.municipality ?? null,
    homeLink: row.homeLink ?? null,
    ppr: null, // OpenAIP-only
    fuel: [], // OpenAIP-only
    openingHours: null, // OurAirports has no hours; filled by OpenAIP if set
    runways: parseJsonArray<RunwayFact>(row.runways),
    frequencies: parseJsonArray<FrequencyFact>(row.frequencies),
    source: row.source,
  };
}

const isEmpty = (f: NormalizedFacts) =>
  f.lat == null &&
  f.lon == null &&
  f.elevationFt == null &&
  f.municipality == null &&
  f.homeLink == null &&
  f.openingHours == null &&
  f.runways.length === 0 &&
  f.frequencies.length === 0;

const firstArray = <T>(...arrays: (T[] | undefined)[]): T[] => {
  for (const a of arrays) if (a && a.length) return a;
  return [];
};

/**
 * Merged aerodrome facts for an ICAO from three sources. Precedence per field:
 *
 * - Shared physical facts (coordinates, elevation, runways, frequencies) take the
 *   first non-empty of **OpenAIP -> OurAirports -> AWC (NOAA)**. OpenAIP first
 *   because it is the richest and its runway objects carry the circuit direction;
 *   OurAirports next (curated public domain); **AWC last but always-on** - free,
 *   no key, no importer - so the card / crosswind / map work out of the box.
 * - Unique fields go to their only source: fuel / PPR / opening hours -> OpenAIP;
 *   town / website -> OurAirports.
 *
 * Returns null when no source has anything, so the card renders nothing.
 */
export async function getAirportFacts(
  icao: string | null | undefined,
): Promise<NormalizedFacts | null> {
  if (!icao || !/^[A-Z]{4}$/.test(icao.toUpperCase())) return null;
  const code = icao.toUpperCase();

  const [row, openaip, awc] = await Promise.all([
    QUERIES.airportFacts(code),
    getOpenAipFacts(code),
    getAwcAirport(code),
  ]);
  const base = row ? rowToFacts(row) : null;
  if (!openaip && !base && !awc) return null;

  const merged: NormalizedFacts = {
    lat: openaip?.lat ?? base?.lat ?? awc?.lat ?? null,
    lon: openaip?.lon ?? base?.lon ?? awc?.lon ?? null,
    elevationFt:
      openaip?.elevationFt ?? base?.elevationFt ?? awc?.elevationFt ?? null,
    municipality: base?.municipality ?? null, // OurAirports only
    homeLink: base?.homeLink ?? null, // OurAirports only
    ppr: openaip?.ppr ?? null, // OpenAIP only
    fuel: openaip?.fuel.length ? openaip.fuel : [], // OpenAIP only
    openingHours: openaip?.openingHours ?? null, // OpenAIP only
    runways: firstArray(openaip?.runways, base?.runways, awc?.runways),
    frequencies: firstArray(
      openaip?.frequencies,
      base?.frequencies,
      awc?.frequencies,
    ),
    source: [openaip?.source, base?.source, awc?.source]
      .filter(Boolean)
      .join("+"),
  };
  return isEmpty(merged) ? null : merged;
}
