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

// Circuit (traffic-pattern) direction. SAFETY-RELEVANT: a wrong left/right is
// worse than none, so we only accept an UNAMBIGUOUS string ("L"/"R"/"LEFT"/
// "RIGHT", any case) and deliberately do NOT guess from a bare numeric enum -
// OpenAIP's `trafficPattern` integer mapping (0 vs 1 = left vs right) is not
// publicly documented (the schema is behind auth), and mislabelling a circuit
// direction on a pilot-facing card is unacceptable. null when absent/numeric.
function parseTrafficPattern(v: unknown): "left" | "right" | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  if (s === "L" || s === "LEFT") return "left";
  if (s === "R" || s === "RIGHT") return "right";
  return null;
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
        trafficPattern: parseTrafficPattern(rr.trafficPattern),
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

// Fuel type codes -> readable labels. OpenAIP returns fuel as string enums; we
// only humanize strings and SKIP anything non-string (a numeric enum we cannot
// map with certainty), because a wrong fuel label is safety-relevant.
const FUEL_LABEL: Record<string, string> = {
  JET_A1: "Jet A-1",
  JET_A: "Jet A",
  JET_B: "Jet B",
  AVGAS_100LL: "AVGAS 100LL",
  AVGAS_100_130: "AVGAS 100/130",
  AVGAS_91_96UL: "AVGAS 91/96UL",
  MOGAS: "MOGAS",
  MO_GAS: "MOGAS",
  DIESEL: "Diesel",
  TS1: "TS-1",
  JP5: "JP-5",
  JP8: "JP-8",
  SAF: "SAF",
};

function parseFuel(item: Record<string, unknown>): string[] {
  const services = item.services as Record<string, unknown> | undefined;
  const raw = services?.fuelTypes ?? item.fuelTypes;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue; // numeric enum: skip rather than mislabel
    const code = v.toUpperCase();
    out.push(FUEL_LABEL[code] ?? code.replace(/_/g, " "));
  }
  return out;
}

// PPR: OpenAIP encodes it as a boolean or a small enum (0 = no, >= 1 = required
// / conditional). null when absent/unrecognized.
function parsePpr(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v >= 1;
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
      municipality: null, // town comes from OurAirports
      homeLink: null,
      ppr: parsePpr(item.ppr),
      fuel: parseFuel(item),
      openingHours: parseOpeningHours(item.hoursOfOperation),
      runways: parseRunways(item.runways),
      frequencies: parseFrequencies(item.frequencies),
      source: "openaip",
    };
  } catch {
    return null;
  }
}
