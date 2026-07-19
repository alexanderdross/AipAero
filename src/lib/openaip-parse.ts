import type { FrequencyFact, RunwayFact } from "~/server/db/schema";
import type { NormalizedFacts } from "~/lib/airport-facts";
import {
  parseStructuredHours,
  structuredHoursToDisplay,
  type StructuredHours,
} from "~/lib/opening-hours";

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
// startTime?, endTime?, sunrise, sunset, byNotam }], remarks? }`. The structured
// extraction + display-string builder now live in `~/lib/opening-hours` (shared
// with the "open now / open until X" feature); this stays the thin display-only
// entry point, falling back to a raw string / `remarks` for unstructured input.
export function parseOpeningHours(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  if (!raw || typeof raw !== "object") return null;
  const structured = parseStructuredHours(raw);
  if (structured) return structuredHoursToDisplay(structured);
  const remarks = (raw as Record<string, unknown>).remarks;
  return typeof remarks === "string" && remarks.trim() ? remarks.trim() : null;
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

// services.passengerFacilities integer enum -> we surface two flags a pilot
// cares about: 5 = Restaurant, 2 = Customs. null when the list is absent (we do
// not assert "no restaurant" from missing data); false when the list exists but
// omits the code.
function hasFacility(
  item: Record<string, unknown>,
  code: number,
): boolean | null {
  const services = item.services as Record<string, unknown> | undefined;
  const raw = services?.passengerFacilities;
  if (!Array.isArray(raw)) return null;
  return raw.includes(code);
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
  const hoursStructured: StructuredHours | null = parseStructuredHours(
    item.hoursOfOperation,
  );
  return {
    lat: Array.isArray(coords) ? num(coords[1]) : null,
    lon: Array.isArray(coords) ? num(coords[0]) : null,
    elevationFt: elev ? toFeet(num(elev.value), elev.unit) : null,
    municipality: null, // town comes from OurAirports
    homeLink: null,
    ppr: parsePpr(item.ppr),
    fuel: parseFuel(item),
    openingHours: parseOpeningHours(item.hoursOfOperation),
    hoursStructured,
    hoursSource: hoursStructured ? "openaip" : null,
    restaurant: hasFacility(item, 5),
    customs: hasFacility(item, 2),
    aerodromeType: typeof item.type === "number" ? item.type : null,
    street: null, // postal address comes from OSM/Nominatim, not OpenAIP
    postcode: null,
    phone: null,
    runways: parseRunways(item.runways),
    frequencies: parseFrequencies(item.frequencies),
    source: "openaip",
  };
}
