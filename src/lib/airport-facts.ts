import "server-only";

import { getOpenAipFacts } from "~/lib/openaip";
import { QUERIES } from "~/server/db/queries";
import type {
  AirportFactsRow,
  FrequencyFact,
  RunwayFact,
} from "~/server/db/schema";

// Source-agnostic aerodrome facts rendered by `AirportFacts`. Merged from the
// OurAirports base (imported into D1, public domain) and, when a key is set, the
// richer OpenAIP API - so the site embeds the data rather than linking out. The
// postal address (street/phone) is layered on separately from OpenStreetMap
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

/**
 * Merged aerodrome facts for an ICAO. OpenAIP (when configured) takes precedence
 * per field group; OurAirports (from D1) fills the gaps. Returns null when
 * neither source has anything, so the card renders nothing.
 */
export async function getAirportFacts(
  icao: string | null | undefined,
): Promise<NormalizedFacts | null> {
  if (!icao || !/^[A-Z]{4}$/.test(icao.toUpperCase())) return null;
  const code = icao.toUpperCase();

  const [row, openaip] = await Promise.all([
    QUERIES.airportFacts(code),
    getOpenAipFacts(code),
  ]);
  const base = row ? rowToFacts(row) : null;

  if (!openaip && !base) return null;
  if (!openaip) return base && !isEmpty(base) ? base : null;
  if (!base) return !isEmpty(openaip) ? openaip : null;

  // Merge: prefer OpenAIP per field group, fall back to OurAirports.
  // Address (municipality/homeLink) only comes from OurAirports; opening hours
  // only from OpenAIP - so each simply takes whichever source has it.
  const merged: NormalizedFacts = {
    lat: openaip.lat ?? base.lat,
    lon: openaip.lon ?? base.lon,
    elevationFt: openaip.elevationFt ?? base.elevationFt,
    municipality: base.municipality ?? openaip.municipality,
    homeLink: base.homeLink ?? openaip.homeLink,
    ppr: openaip.ppr ?? base.ppr,
    fuel: openaip.fuel.length ? openaip.fuel : base.fuel,
    openingHours: openaip.openingHours ?? base.openingHours,
    runways: openaip.runways.length ? openaip.runways : base.runways,
    frequencies: openaip.frequencies.length
      ? openaip.frequencies
      : base.frequencies,
    source: [openaip.source, base.source].join("+"),
  };
  return isEmpty(merged) ? null : merged;
}
