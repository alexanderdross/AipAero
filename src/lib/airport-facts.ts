import "server-only";

import { after } from "next/server";
import { getAwcAirport } from "~/lib/awc-airport";
import { customsOverride } from "~/lib/customs-overrides";
import { getOpenAipFacts } from "~/lib/openaip";
import type { StructuredHours } from "~/lib/opening-hours";
import { MUTATIONS, QUERIES } from "~/server/db/queries";
import type {
  AirportFactsRow,
  DeclaredDistances,
  FrequencyFact,
  InsertAirportFacts,
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
// When a live source fills a gap, the merged row is written back to D1 after the
// response (`after()` + `MUTATIONS.persistAirportFacts`), so the next visit reads
// everything from the database - self-populating, no importer for OpenAIP values.
export interface NormalizedFacts {
  lat: number | null;
  lon: number | null;
  elevationFt: number | null;
  municipality: string | null; // town/city
  homeLink: string | null; // official airport website
  ppr: boolean | null; // prior permission required
  fuel: string[]; // available fuel types
  openingHours: string | null; // hours of operation (human display string)
  // Structured, queryable operation hours (7 days) + their provenance - powers
  // the "open now / open until X" badge + map filter (opening-hours.ts). Null
  // when the source carries no machine-readable hours (only free text/remarks).
  hoursStructured: StructuredHours | null;
  hoursSource: string | null; // "eaip" (authoritative) | "openaip" | "osm" (community)
  restaurant: boolean | null; // on-field restaurant
  customs: boolean | null; // customs / airport of entry
  aerodromeType: number | null; // OpenAIP airport `type` enum (label resolved in UI)
  street: string | null; // street + house number (persisted OSM address)
  postcode: string | null; // postal code (persisted OSM address)
  phone: string | null; // contact phone (persisted OSM address)
  runways: RunwayFact[];
  frequencies: FrequencyFact[];
  // AD 2.13 declared distances per runway (metres), from the eAIP - null when
  // the source carries none. Authoritative-only (no live fallback source).
  declaredDistances: DeclaredDistances | null;
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

// Persisted hours_structured JSON -> StructuredHours (7-day array), or null.
function parseStructuredJson(raw: string | null): StructuredHours | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.length === 7 ? (v as StructuredHours) : null;
  } catch {
    return null;
  }
}

// Persisted declared_distances JSON -> DeclaredDistances, or null.
function parseDeclaredJson(raw: string | null): DeclaredDistances | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as DeclaredDistances)
      : null;
  } catch {
    return null;
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
    hoursStructured: parseStructuredJson(row.hoursStructured),
    hoursSource: row.hoursSource ?? null,
    restaurant: row.restaurant ?? null,
    customs: row.customs ?? null,
    aerodromeType: row.aerodromeType ?? null,
    street: row.street ?? null,
    postcode: row.postcode ?? null,
    phone: row.phone ?? null,
    runways: parseJsonArray<RunwayFact>(row.runways),
    frequencies: parseJsonArray<FrequencyFact>(row.frequencies),
    declaredDistances: parseDeclaredJson(row.declaredDistances),
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

// Merged facts -> the D1 row shape, for the on-read write-back.
function toRow(icao: string, f: NormalizedFacts): InsertAirportFacts {
  return {
    icao,
    lat: f.lat,
    lon: f.lon,
    elevationFt: f.elevationFt,
    municipality: f.municipality,
    homeLink: f.homeLink,
    runways: f.runways.length ? JSON.stringify(f.runways) : null,
    frequencies: f.frequencies.length ? JSON.stringify(f.frequencies) : null,
    declaredDistances: f.declaredDistances
      ? JSON.stringify(f.declaredDistances)
      : null,
    declaredSource: f.declaredDistances ? "eaip" : null,
    street: f.street,
    postcode: f.postcode,
    phone: f.phone,
    fuel: f.fuel.length ? JSON.stringify(f.fuel) : null,
    openingHours: f.openingHours,
    hoursStructured: f.hoursStructured
      ? JSON.stringify(f.hoursStructured)
      : null,
    hoursSource: f.hoursSource,
    ppr: f.ppr,
    aerodromeType: f.aerodromeType,
    restaurant: f.restaurant,
    customs: f.customs,
    source: f.source,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

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

  // Fail-soft to the live sources: this must not throw if the D1 row read
  // fails (e.g. migration 0004 not yet applied when the code deploys, or a
  // transient D1 error) - the page then renders from OpenAIP/AWC as before.
  const row = await QUERIES.airportFacts(code).catch(() => undefined);
  const base = row ? rowToFacts(row) : null;

  // The D1 row is primary - only fire the live fetches for what it cannot
  // answer, instead of unconditionally on every render (2 external
  // subrequests per detail view whose results were usually discarded):
  // - OpenAIP: skipped once the write-back has run (`source` carries
  //   "openaip", meaning everything OpenAIP offers is already merged in).
  // - AWC: only when a field it can fill (coords/elevation/runways/
  //   frequencies) is still missing from the row.
  const needOpenaip = !(base?.source.includes("openaip") ?? false);
  const needAwc =
    !base ||
    base.lat == null ||
    base.lon == null ||
    base.elevationFt == null ||
    base.runways.length === 0 ||
    base.frequencies.length === 0;
  const [openaip, awc] = await Promise.all([
    needOpenaip ? getOpenAipFacts(code) : null,
    needAwc ? getAwcAirport(code) : null,
  ]);
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
    // The D1 row wins - it already carries any authoritative eAIP hours the
    // crawler POSTed; the live OpenAIP fetch only fills an ICAO with none.
    hoursStructured: base?.hoursStructured ?? openaip?.hoursStructured ?? null,
    hoursSource: base?.hoursStructured
      ? (base.hoursSource ?? null)
      : (openaip?.hoursSource ?? null),
    restaurant: base?.restaurant ?? openaip?.restaurant ?? null,
    // Verified GEN-1.2 override first (compliance-grade, in code - see
    // customs-overrides.ts), then the persisted/community sources.
    customs: customsOverride(code) ?? base?.customs ?? openaip?.customs ?? null,
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
    // Declared distances are eAIP-only (persisted in D1); no live source.
    declaredDistances: base?.declaredDistances ?? null,
    source: [base?.source, openaip?.source, awc?.source]
      .filter(Boolean)
      .join("+"),
  };
  if (isEmpty(merged)) return null;

  // Write-back: when the live OpenAIP enrichment is present but the D1 row does
  // not yet reflect it (first visit, or an ICAO the importer never enriched),
  // persist the merged row AFTER the response so next time it is a DB read. The
  // `source` marker bounds this to once per field (once the row carries
  // "openaip", the guard is false). Fail-soft: any error is swallowed.
  const alreadyPersisted = base?.source?.includes("openaip") ?? false;
  if (openaip && !alreadyPersisted) {
    const row = toRow(code, merged);
    try {
      after(async () => {
        try {
          await MUTATIONS.persistAirportFacts(row);
        } catch {
          /* best-effort cache-aside; ignore write failures */
        }
      });
    } catch {
      /* `after` unavailable in this context - skip the write-back */
    }
  }
  return merged;
}
