import "server-only";

import { env } from "~/env";
import type { FrequencyFact, RunwayFact } from "~/server/db/schema";
import type { NormalizedFacts } from "~/lib/airport-facts";

// OpenAIP core API client. Per-ICAO lookup, cached, fully fail-soft: no key, a
// non-OK response, malformed JSON or a timeout all yield `null` so the facts
// card simply falls back to the OurAirports data (or renders nothing).
//
// Schema/enums verified against real consumers of the API (auth header
// `x-openaip-api-key`; `elevation.value` with unit 0 = metres; runway
// `dimension.{length,width}.{value,unit}`; `surface.mainComposite` enum;
// frequency `value` + human-readable `name`). See docs/pilot-wishlist.md.

const API = "https://api.core.openaip.net/api/airports";
const REVALIDATE = 60 * 60 * 24 * 7; // 7 days - facts change rarely
const TIMEOUT_MS = 4000;
const M_TO_FT = 3.28084;

// surface.mainComposite -> label (partial; only the codes we are confident
// about, else undefined so we omit rather than mislabel).
const SURFACE: Record<number, string> = {
  0: "Asphalt",
  1: "Concrete",
  2: "Grass",
  4: "Water",
  5: "Gravel",
  6: "Sand",
};

// frequency.type -> label, used only when the item has no human-readable `name`.
const FREQ_TYPE: Record<number, string> = {
  0: "Approach",
  4: "CTAF",
  12: "Unicom",
  14: "Tower",
  15: "ATIS",
};

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

// value in the given OpenAIP unit (0 = metres, 1 = feet) -> feet.
function toFeet(value: number | null, unit: unknown): number | null {
  if (value == null) return null;
  return unit === 1 ? Math.round(value) : Math.round(value * M_TO_FT);
}

function parseRunways(raw: unknown): RunwayFact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): RunwayFact | null => {
      const rr = r as Record<string, unknown>;
      const designator = typeof rr.designator === "string" ? rr.designator : "";
      if (!designator) return null;
      const dim = rr.dimension as Record<string, Record<string, unknown>>;
      const surfaceCode = (rr.surface as Record<string, unknown>)
        ?.mainComposite;
      return {
        ident: designator,
        lengthFt: dim?.length
          ? toFeet(num(dim.length.value), dim.length.unit)
          : null,
        widthFt: dim?.width
          ? toFeet(num(dim.width.value), dim.width.unit)
          : null,
        surface:
          typeof surfaceCode === "number"
            ? (SURFACE[surfaceCode] ?? null)
            : null,
      };
    })
    .filter((r): r is RunwayFact => r !== null);
}

// Best-effort hours of operation. The OpenAIP airport model is not publicly
// documented for this field (the spec is behind auth), so we accept only shapes
// we are sure read cleanly: a plain string, or an object carrying a human string
// under `remarks`/`operatingHours`. Anything else yields null (fail-soft), so we
// never render a raw object dump - the card simply omits opening hours.
function parseOpeningHours(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["remarks", "operatingHours", "text", "description"]) {
      if (typeof o[k] === "string" && o[k].trim())
        return (o[k] as string).trim();
    }
  }
  return null;
}

function parseFrequencies(raw: unknown): FrequencyFact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f): FrequencyFact | null => {
      const ff = f as Record<string, unknown>;
      const mhz = typeof ff.value === "string" ? ff.value : null;
      if (!mhz) return null;
      const name = typeof ff.name === "string" ? ff.name : null;
      const type =
        name ?? (typeof ff.type === "number" ? (FREQ_TYPE[ff.type] ?? "") : "");
      return { type, description: name, mhz };
    })
    .filter((f): f is FrequencyFact => f !== null);
}

export async function getOpenAipFacts(
  icao: string,
): Promise<NormalizedFacts | null> {
  const key = env.OPENAIP_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${API}?search=${icao}&limit=1`, {
      headers: { "x-openaip-api-key": key },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const items = (json as { items?: unknown[] })?.items;
    const item = (Array.isArray(items) ? items[0] : undefined) as
      | Record<string, unknown>
      | undefined;
    if (!item || item.icaoCode !== icao) return null;

    const coords = (item.geometry as { coordinates?: unknown[] })?.coordinates;
    const elev = item.elevation as Record<string, unknown> | undefined;
    return {
      lat: Array.isArray(coords) ? num(coords[1]) : null,
      lon: Array.isArray(coords) ? num(coords[0]) : null,
      elevationFt: elev ? toFeet(num(elev.value), elev.unit) : null,
      municipality: null, // OpenAIP has no reliable town field; OurAirports fills it
      homeLink: null,
      openingHours: parseOpeningHours(item.hoursOfOperation),
      runways: parseRunways(item.runways),
      frequencies: parseFrequencies(item.frequencies),
      source: "openaip",
    };
  } catch {
    return null;
  }
}
