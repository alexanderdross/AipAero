import "server-only";

import { getAwcAirport } from "~/lib/awc-airport";
import { getOpenAipFacts } from "~/lib/openaip";
import { QUERIES } from "~/server/db/queries";
import type {
  AirportFactsRow,
  FrequencyFact,
  RunwayFact,
} from "~/server/db/schema";

// Source-agnostic aerodrome facts rendered by `AirportFacts`. Precedence (see
// `getAirportFacts`): the **D1 row is primary** - the importer persists the full
// enrichment (OpenAIP + OpenStreetMap) into `airport_facts`, so the detail page
// reads values from the database instead of fetching them live per request. The
// live sources are FALLBACKS for ICAOs not yet backfilled:
//   - OpenAIP  (`OPENAIP_API_KEY`): fuel / PPR / opening hours / type / etc.
//   - AWC/NOAA (no key): coordinates / elevation / runways / frequencies.
//   - Nominatim (in the gadgets wrapper): postal address, when D1 has none.
export interface NormalizedFacts {
  lat: number | null;
  lon: number | null;
  elevationFt: number | null;
  municipality: string | null; // town/city
  homeLink: string | null; // official airport website
  ppr: boolean | null; // prior permission required
  fuel: string[]; // available fuel types
  openingHours: string | null; // hours of operation
  restaurant: boolean | null; // on-field restaurant
  customs: boolean | null; // customs / airport of entry
  aerodromeType: number | null; // OpenAIP airport `type` enum (label resolved in UI)
  street: string | null; // street + house number (persisted OSM address)
  postcode: string | null; // postal code (persisted OSM address)
  phone: string | null; // contact phone (persisted OSM address)
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

// The persisted D1 row -> NormalizedFacts. Once the importer has backfilled a
// field, this is what the page renders (no live fetch).
function rowToFacts(row: AirportFactsRow): NormalizedFacts {
  return {
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    elevationFt: row.elevationFt ?? null,
    municipality: row.municipality ?? null,
    homeLink: row.homeLink ?? null,
    ppr: row.ppr ?? null,
    fuel: parseJsonArray<string>(row.fuel),
    openingHours: row.openingHours ?? null,
    restaurant: row.restaurant ?? null,
    customs: row.customs ?? null,
    aerodromeType: row.aerodromeType ?? null,
    street: row.street ?? null,
    postcode: row.postcode ?? null,
    phone: row.phone ?? null,
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
 * Merged aerodrome facts for an ICAO. The **persisted D1 row wins** for every
 * field (that is the point - values come from the database, populated by the
 * importer); the live OpenAIP and AWC fetches only fill fields the row is missing
 * (an ICAO not yet backfilled, or a field the importer had no value for). `??`
 * preserves a stored `false` (e.g. PPR = no). Returns null when nothing is known.
 */
export async function getAirportFacts(
  icao: string | null | undefined,
): Promise<NormalizedFacts | null> {
  if (!icao || !/^[A-Z]{4}$/.test(icao.toUpperCase())) return null;
  const code = icao.toUpperCase();

  const [row, openaip, awc] = await Promise.all([
    // Fail-soft to the live sources: this must not throw if the D1 row read
    // fails (e.g. migration 0004 not yet applied when the code deploys, or a
    // transient D1 error) - the page then renders from OpenAIP/AWC as before.
    QUERIES.airportFacts(code).catch(() => undefined),
    getOpenAipFacts(code),
    getAwcAirport(code),
  ]);
  const base = row ? rowToFacts(row) : null;
  if (!openaip && !base && !awc) return null;

  const merged: NormalizedFacts = {
    lat: base?.lat ?? openaip?.lat ?? awc?.lat ?? null,
    lon: base?.lon ?? openaip?.lon ?? awc?.lon ?? null,
    elevationFt:
      base?.elevationFt ?? openaip?.elevationFt ?? awc?.elevationFt ?? null,
    municipality: base?.municipality ?? null,
    homeLink: base?.homeLink ?? null,
    ppr: base?.ppr ?? openaip?.ppr ?? null,
    fuel: base?.fuel.length ? base.fuel : (openaip?.fuel ?? []),
    openingHours: base?.openingHours ?? openaip?.openingHours ?? null,
    restaurant: base?.restaurant ?? openaip?.restaurant ?? null,
    customs: base?.customs ?? openaip?.customs ?? null,
    aerodromeType: base?.aerodromeType ?? openaip?.aerodromeType ?? null,
    street: base?.street ?? null,
    postcode: base?.postcode ?? null,
    phone: base?.phone ?? null,
    runways: firstArray(base?.runways, openaip?.runways, awc?.runways),
    frequencies: firstArray(
      base?.frequencies,
      openaip?.frequencies,
      awc?.frequencies,
    ),
    source: [base?.source, openaip?.source, awc?.source]
      .filter(Boolean)
      .join("+"),
  };
  return isEmpty(merged) ? null : merged;
}
