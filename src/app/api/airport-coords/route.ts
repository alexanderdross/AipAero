import { customsOverride } from "~/lib/customs-overrides";
import { hoursOverride } from "~/lib/hours-overrides";
import { NextResponse } from "next/server";
import { getPathname } from "~/i18n/routing";
import { i18nPathMapping } from "~/lib/utils";
import { withEdgeCache } from "~/server/edge-cache";
import { QUERIES } from "~/server/db/queries";

/**
 * Map markers for the airport-list map, served as a small standalone endpoint.
 *
 * The map is decorative (client-only Leaflet, it illustrates coverage - it is
 * NOT indexable page content), and a country can have hundreds of fields with
 * coordinates. Serialising all of those markers into the airport-list page's
 * server render inflated its memory / payload and was a contributor to the
 * Cloudflare Worker "Error 1102 - exceeded resource limits" on the large DE
 * page when it regenerated. Moving the markers here keeps them off that heavy
 * render; the indexable airport list stays fully server-rendered.
 *
 * Reads go through the cached `QUERIES.airportsWithCoords` (per-country tag), and
 * the response carries a `Cache-Control` so browsers / the edge cache it. DB
 * reads fail-soft to `[]` during the build and when no D1 binding is present.
 *
 * `withEdgeCache` serves repeat hits from the Cloudflare Cache API (keyed on
 * the URL incl. `?locale`) - without it every map view is a full Worker
 * invocation, because `s-maxage` alone is inert for Worker responses. That HTTP
 * edge cache is NOT reachable by `revalidateTag`, so it can only expire by time:
 * the max-age is kept modest (15 min) to bound how stale the map's decorative
 * "open now" hours filter can be after a crawler updates a field's hours, while
 * still absorbing the bulk of repeat map views. The indexable detail page is
 * unaffected - it refreshes promptly on the tag bust (see the concept doc).
 */
export async function GET(request: Request): Promise<Response> {
  return withEdgeCache(request, () => handleCoords(request));
}

// Paved-surface heuristic for the map's "paved runway" filter. Surfaces come
// from OurAirports codes ("ASP", "CON", "PEM", "BIT", ...) or free text
// ("Asphalt", "concrete", "tarmac"); anything not clearly paved (grass,
// gravel, water, unknown/null) counts as not paved - the filter must never
// promise a hard surface it cannot back up.
const PAVED_RE = /asp|con|pem|bit|tarmac|paved|seal|macadam/i;

function hasPavedRunway(runwaysJson: string | null | undefined): boolean {
  if (!runwaysJson) return false;
  try {
    const runways = JSON.parse(runwaysJson) as Array<{
      surface?: string | null;
    }>;
    return (
      Array.isArray(runways) &&
      runways.some((r) => r?.surface && PAVED_RE.test(r.surface))
    );
  } catch {
    return false;
  }
}

function hasFuel(fuelJson: string | null | undefined): boolean {
  if (!fuelJson) return false;
  try {
    const fuel = JSON.parse(fuelJson) as unknown[];
    return Array.isArray(fuel) && fuel.length > 0;
  } catch {
    return false;
  }
}

// Structured hours (JSON string) for a marker: the verified override wins over
// the stored D1 value, else the stored value passes through; `{}` when neither.
// An override also carries its IANA `hoursTz` (local-time evaluation) so the
// map's "open now" filter matches the detail page's LT badge.
function hoursMarker(
  icao: string | null | undefined,
  stored: string | null | undefined,
): { hours: string; hoursTz?: string } | Record<string, never> {
  const ov = hoursOverride(icao);
  const hours = ov ? JSON.stringify(ov.hours) : stored;
  if (!hours) return {};
  return ov?.tz ? { hours, hoursTz: ov.tz } : { hours };
}

async function handleCoords(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? "";
  const country = locale.split("-")[0];
  if (!country) {
    return NextResponse.json([]);
  }

  // Fail soft: the map is decorative, so a DB hiccup (or, at runtime, the
  // re-thrown "DB read failed" from cachedRead) must yield an empty marker set,
  // never a 500 that breaks the request.
  const withCoords = await QUERIES.airportsWithCoords(country).catch(() => []);
  const markers = withCoords
    .filter((a) => a.lat != null && a.lon != null)
    .map((a) => ({
      title: a.title,
      type: a.type,
      lat: a.lat!,
      lon: a.lon!,
      href:
        getPathname({ href: i18nPathMapping[a.type], locale }) + `?${a.slug}`,
      // Facts flags for the map filters, reduced to booleans server-side and
      // OMITTED when false: an absent key reads as falsy in the map's filter
      // check, and serialising `"fuel":false,...` on every marker would add
      // ~40 bytes x hundreds of markers (~30 KB on DE) for no information -
      // false only means "not known to have it", never a verified negative.
      ...(hasFuel(a.fuel) && { fuel: true }),
      // Verified GEN-1.2 override wins over the community/D1 value, so the
      // map filter and the detail page's contact box always agree.
      ...((customsOverride(a.icao) ?? a.customs) === true && {
        customs: true,
      }),
      ...(hasPavedRunway(a.runways) && { paved: true }),
      // Structured operation hours (JSON) for the "open now / open until X"
      // map filter; omitted when the field has none so the Operating-hours tab
      // hides. A verified hours override wins over the stored D1 value, so the
      // map filter matches the detail page's badge/table.
      ...hoursMarker(a.icao, a.hoursStructured),
    }));

  return NextResponse.json(markers, {
    headers: {
      // 15 min: bounds how stale the map's decorative "open now" hours filter
      // can be (the HTTP edge cache can't be busted by revalidateTag) while
      // still serving most repeat map views from cache.
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
