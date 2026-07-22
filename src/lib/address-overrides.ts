/**
 * Verified postal-address overrides for aerodromes.
 *
 * The contact/location box normally derives the street / postcode / town from
 * the persisted `airport_facts` row (OSM address backfilled by the importer)
 * or, as a fallback, a live Nominatim REVERSE geocode of the field's
 * coordinates. Reverse-geocoding an aerodrome is inherently imprecise: OSM
 * snaps to the nearest addressable road, which is frequently NOT the field's
 * real postal address (e.g. EDPE resolves to "Fritz-Rindfleisch-Allee", a
 * nearby street, instead of "Flugplatz 1"). The town / postcode are usually
 * right; the street is the unreliable part.
 *
 * Entries here are VERIFIED against the aerodrome's official listing (its own
 * website / the operator, cross-checked on the map) and WIN over every
 * automatic source at read time, in the facts merge AND the Airport JSON-LD
 * `address` (they are computed from the same values). Mirrors the verified
 * per-field override pattern used for customs / hours / circuit direction.
 *
 * Key: ICAO code (uppercase). Value: the verified address parts (any field may
 * be omitted; an omitted part falls through to the automatic value). Absent =
 * no override, the merged D1/OSM value applies.
 */
export interface AddressOverride {
  street?: string; // street + house number, e.g. "Flugplatz 1"
  postcode?: string;
  city?: string;
}

export const addressOverrides: Record<string, AddressOverride> = {
  // Flugplatz Eichstätt: reverse-geocode returned the nearby
  // "Fritz-Rindfleisch-Allee"; the field's real address is Flugplatz 1
  // (verified against the operator's listing + Google Maps, 22.07.2026).
  EDPE: { street: "Flugplatz 1", postcode: "85072", city: "Eichstätt" },
};

/** Verified address override for an ICAO, or undefined when none exists. */
export function addressOverride(
  icao: string | null | undefined,
): AddressOverride | undefined {
  if (!icao) return undefined;
  return addressOverrides[icao.toUpperCase()];
}
