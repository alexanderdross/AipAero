import type { NormalizedFacts } from "~/lib/airport-facts";

/**
 * Manual override layer for wrongly-fetched aerodrome facts.
 *
 * The aerodrome-data card merges several automatic sources (OurAirports,
 * OpenAIP, AWC/NOAA, and OpenStreetMap reverse-geocoding). Any of them can be
 * wrong or imprecise for a given field - e.g. EDPE's coordinates sit ~250 m off
 * the airfield, so OSM reverse-geocodes to a nearby street ("Fritz-Rindfleisch-
 * Allee") instead of the official "Flugplatz 1", and the Google Maps pin lands
 * beside the field. This map lets a VERIFIED per-ICAO value WIN over every
 * automatic source.
 *
 * It is applied at the single `getAirportFacts` choke point (via Object.assign
 * over the merged facts), so every consumer reads the corrected value: the
 * contact/location box, the Google Maps link, the coordinates line, the weather
 * / nearby / sun-time gadgets, and the Airport JSON-LD. When a coordinate
 * override is present it is also persisted on the next enrichment write-back, so
 * the airport-list map marker picks it up too.
 *
 * This is the general escape hatch. Fields with SPECIAL merge semantics keep
 * their own dedicated, compliance-graded override files and are intentionally
 * NOT overridable here: operating hours (seasonal UTC resolution -
 * `hours-overrides.ts`), customs / Airport-of-Entry (`customs-overrides.ts`),
 * and traffic-circuit direction (per-runway-ident merge - `circuit-overrides.ts`).
 *
 * Key: ICAO code (uppercase). Value: the verified fields to override (any
 * omitted field falls through to the automatic value). Only add VERIFIED data -
 * a wrong value here overrides the (possibly correct) automatic source.
 */
export type FactsOverride = Partial<
  Pick<
    NormalizedFacts,
    | "lat"
    | "lon"
    | "elevationFt"
    | "municipality"
    | "street"
    | "postcode"
    | "phone"
    | "homeLink"
    | "aerodromeType"
    | "ppr"
    | "restaurant"
    | "fuel"
    | "runways"
    | "frequencies"
  >
>;

export const factsOverrides: Record<string, FactsOverride> = {
  // Flugplatz Eichstätt: OSM tags the aerodrome node with the nearby street
  // "Fritz-Rindfleisch-Allee", so reverse-geocoding never yields the official
  // "Flugplatz 1", and the stored coordinates sit ~250 m off the field. Both
  // verified against Google Maps' own "Flugplatz Eichstätt - EDPE" place marker
  // (22.07.2026): the corrected coordinates fix the address, the Google Maps pin
  // and the coordinates line together.
  EDPE: {
    street: "Flugplatz 1",
    postcode: "85072",
    municipality: "Eichstätt",
    lat: 48.8785232,
    lon: 11.1798629,
  },
};

/** Verified facts override for an ICAO, or undefined when none exists. */
export function factsOverride(
  icao: string | null | undefined,
): FactsOverride | undefined {
  if (!icao) return undefined;
  return factsOverrides[icao.toUpperCase()];
}
