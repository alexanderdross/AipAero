import "server-only";

// Reverse geocoding via OpenStreetMap Nominatim. Turns an airport's coordinates
// into a postal address (street / postcode / town) plus, when OSM carries them,
// contact phone, website and opening hours. Runs server-side on the Worker,
// cached hard (coordinates never move) so the upstream is hit at most ~once per
// airport per REVALIDATE window - well within Nominatim's usage policy - and
// fully fail-soft: a non-OK response, malformed JSON or a timeout yields null.
//
// A descriptive User-Agent is required by the Nominatim usage policy.

const API = "https://nominatim.openstreetmap.org/reverse";
const REVALIDATE = 60 * 60 * 24 * 30; // 30 days - a field does not move
const TIMEOUT_MS = 2500;
const USER_AGENT = "AIP:Aero/1.0 (+https://aip.aero)";

export interface GeoResult {
  road: string | null;
  houseNumber: string | null;
  postcode: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<GeoResult | null> {
  try {
    const url = `${API}?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&extratags=1&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      address?: Record<string, unknown>;
      extratags?: Record<string, unknown>;
    };
    const a = json.address ?? {};
    const e = json.extratags ?? {};
    const city =
      str(a.city) ??
      str(a.town) ??
      str(a.village) ??
      str(a.municipality) ??
      str(a.hamlet);
    return {
      road: str(a.road),
      houseNumber: str(a.house_number),
      postcode: str(a.postcode),
      city,
      phone: str(e.phone) ?? str(e["contact:phone"]),
      website: str(e.website) ?? str(e["contact:website"]),
      openingHours: str(e.opening_hours),
    };
  } catch {
    return null;
  }
}
