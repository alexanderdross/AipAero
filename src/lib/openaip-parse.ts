import type { FrequencyFact, RunwayFact } from "~/server/db/schema";
import type { NormalizedFacts } from "~/lib/airport-facts";

// Pure parsing of the OpenAIP core API airport payload into our NormalizedFacts.
// No network, no `server-only`, no env - so it is unit-testable (openaip.ts is
// the thin fetch client on top). Field names and enum values come from the
// authoritative, public v1 airport response schema:
//   https://api.core.openaip.net/api/schemas/response/airport/airport-schema.json

const M_TO_FT = 3.28084;

// surface.mainComposite integer enum -> label (from the airport schema). Codes
// outside this map yield undefined so we omit rather than mislabel.
const SURFACE: Record<number, string> = {
  0: "Asphalt",
  1: "Concrete",
  2: "Grass",
  3: "Sand",
  4: "Water",
  5: "Bituminous",
  6: "Brick",
  7: "Macadam",
  8: "Stone",
  9: "Coral",
  10: "Clay",
  11: "Laterite",
  12: "Gravel",
  13: "Earth",
  14: "Ice",
  15: "Snow",
  17: "Metal",
  20: "Wood",
  22: "Unknown",
};

// frequency.type integer enum -> label (from the airport schema), used only when
// the item has no human-readable `name`.
const FREQ_TYPE: Record<number, string> = {
  0: "Approach",
  1: "Apron",
  2: "Arrival",
  3: "Center",
  4: "CTAF",
  5: "Delivery",
  6: "Departure",
  7: "FIS",
  8: "Gliding",
  9: "Ground",
  10: "Information",
  11: "Multicom",
  12: "Unicom",
  13: "Radar",
  14: "Tower",
  15: "ATIS",
  16: "Radio",
  17: "Other",
  19: "AWOS",
  22: "AFIS",
  25: "Emergency",
  26: "Clearance Delivery",
};

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

// value in the given OpenAIP unit (0 = metres, 1 = feet) -> feet.
function toFeet(value: number | null, unit: unknown): number | null {
  if (value == null) return null;
  return unit === 1 ? Math.round(value) : Math.round(value * M_TO_FT);
}

// Circuit (traffic-pattern) direction from the runway `turnDirection` integer
// enum (authoritative schema: 0 = Right, 1 = Left, 2 = Both). SAFETY-RELEVANT:
// a wrong left/right is worse than none, so we map only the two unambiguous
// single-direction codes; "Both" (2) and any unexpected value yield null (the
// card then omits the circuit note rather than showing an ambiguous "both").
function parseTurnDirection(v: unknown): "left" | "right" | null {
  if (v === 0) return "right";
  if (v === 1) return "left";
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
        trafficPattern: parseTurnDirection(rr.turnDirection),
      };
    })
    .filter((r): r is RunwayFact => r !== null);
}

// Hours of operation. Schema: `{ operatingHours: [{ dayOfWeek 0..6 (Mon..Sun),
// startTime?, endTime?, sunrise, sunset, byNotam }], remarks? }`. We build a
// compact per-day schedule, grouping consecutive days with identical hours
// ("Mon-Fri 08:00-20:00; Sat SR-SS"). Days with no usable window are omitted.
// Any unexpected shape yields null (fail-soft) so we never dump a raw object.
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hhmm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{2}:\d{2})/.exec(v.trim());
  return m ? m[1]! : null;
}

// One day's window, e.g. "08:00-20:00", "SR-SS", "08:00-SS", "by NOTAM", or null.
function dayWindow(e: Record<string, unknown>): string | null {
  if (e.byNotam === true) return "by NOTAM";
  const start = e.sunrise === true ? "SR" : hhmm(e.startTime);
  const end = e.sunset === true ? "SS" : hhmm(e.endTime);
  if (!start || !end) return null;
  return `${start}-${end}`;
}

export function parseOpeningHours(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const entries = o.operatingHours;
  if (!Array.isArray(entries)) {
    return typeof o.remarks === "string" && o.remarks.trim()
      ? o.remarks.trim()
      : null;
  }
  // day index (0..6) -> window string
  const byDay = new Map<number, string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const d = e.dayOfWeek;
    if (typeof d !== "number" || d < 0 || d > 6) continue;
    const w = dayWindow(e);
    if (w && !byDay.has(d)) byDay.set(d, w);
  }
  if (byDay.size === 0) return null;
  // Group consecutive days (Mon..Sun) sharing the same window.
  const parts: string[] = [];
  let runStart: number | null = null;
  for (let d = 0; d <= 7; d++) {
    const w = d <= 6 ? byDay.get(d) : undefined;
    const prev = d > 0 ? byDay.get(d - 1) : undefined;
    if (w && w === prev) continue; // extend current run
    if (runStart != null && prev) {
      const label =
        runStart === d - 1
          ? DAY_LABELS[runStart]
          : `${DAY_LABELS[runStart]}-${DAY_LABELS[d - 1]}`;
      parts.push(`${label} ${prev}`);
    }
    runStart = w ? d : null;
  }
  return parts.length ? parts.join("; ") : null;
}

// services.fuelTypes integer enum -> readable label (authoritative schema).
// Codes outside this map are skipped rather than mislabelled (safety-relevant).
const FUEL_LABEL: Record<number, string> = {
  0: "Super PLUS",
  1: "AVGAS",
  2: "Jet A",
  3: "Jet A-1",
  4: "Jet B",
  5: "Diesel",
  6: "AVGAS UL91",
};

function parseFuel(item: Record<string, unknown>): string[] {
  const services = item.services as Record<string, unknown> | undefined;
  const raw = services?.fuelTypes ?? item.fuelTypes;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "number") continue; // only the documented integer enum
    const label = FUEL_LABEL[v];
    if (label) out.push(label);
  }
  return out;
}

// PPR (prior permission required): boolean in the schema. null when absent.
function parsePpr(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
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

// Pure mapping of a raw OpenAIP airport item to our NormalizedFacts. Exported
// for unit testing against the authoritative schema (see openaip.test.ts).
export function mapOpenAipItem(item: Record<string, unknown>): NormalizedFacts {
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
}
