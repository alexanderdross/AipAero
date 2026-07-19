import "server-only";

import type { NormalizedFacts } from "~/lib/airport-facts";
import type { FrequencyFact, RunwayFact } from "~/server/db/schema";

// Aerodrome facts from the NOAA / Aviation Weather Center "airport" data endpoint
// (https://aviationweather.gov/data/api/) - the same free, no-key API we already
// use for METAR/TAF. It returns coordinates, elevation (feet), runways
// (id + "LENGTHxWIDTH" feet + surface) and a frequencies string, so it is a
// third, free facts source that works WITHOUT the OurAirports importer or an
// OpenAIP key. Cached, fail-soft.

const API = "https://aviationweather.gov/api/data/airport";
const REVALIDATE = 60 * 60 * 24 * 7; // 7 days - facts change rarely
const TIMEOUT_MS = 2000;

// AWC single-letter surface code -> label.
const SURFACE: Record<string, string> = { H: "Hard", S: "Grass", W: "Water" };

function parseRunways(raw: unknown): RunwayFact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): RunwayFact | null => {
      const rr = r as Record<string, unknown>;
      const ident = typeof rr.id === "string" ? rr.id : "";
      if (!ident) return null;
      const dim = typeof rr.dimension === "string" ? rr.dimension : "";
      const [lStr, wStr] = dim.split("x");
      const surface = typeof rr.surface === "string" ? rr.surface : "";
      return {
        ident,
        lengthFt: lStr && /^\d+$/.test(lStr) ? parseInt(lStr, 10) : null,
        widthFt: wStr && /^\d+$/.test(wStr) ? parseInt(wStr, 10) : null,
        surface: SURFACE[surface] ?? null,
      };
    })
    .filter((r): r is RunwayFact => r !== null);
}

// "ATIS,129.6;TWR,120.08" -> [{type:"ATIS", mhz:"129.6"}, ...]
function parseFreqs(raw: unknown): FrequencyFact[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(";")
    .map((pair): FrequencyFact | null => {
      const [type, mhz] = pair.split(",");
      if (!type?.trim() || !mhz?.trim()) return null;
      return { type: type.trim(), description: null, mhz: mhz.trim() };
    })
    .filter((f): f is FrequencyFact => f !== null);
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

export async function getAwcAirport(
  icao: string,
): Promise<NormalizedFacts | null> {
  try {
    const res = await fetch(`${API}?ids=${icao}&format=json`, {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const item = (Array.isArray(json) ? json[0] : undefined) as
      | Record<string, unknown>
      | undefined;
    if (!item || item.icaoId !== icao) return null;

    return {
      lat: num(item.lat),
      lon: num(item.lon),
      elevationFt:
        num(item.elev) === null ? null : Math.round(item.elev as number),
      municipality: null,
      homeLink: null,
      ppr: null,
      fuel: [],
      openingHours: null,
      hoursStructured: null,
      hoursSource: null,
      restaurant: null,
      customs: null,
      aerodromeType: null,
      street: null,
      postcode: null,
      phone: null,
      runways: parseRunways(item.runways),
      frequencies: parseFreqs(item.freqs),
      declaredDistances: null, // eAIP-only; AWC carries none
      source: "awc",
    };
  } catch {
    return null;
  }
}
