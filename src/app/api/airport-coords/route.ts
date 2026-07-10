import { NextResponse } from "next/server";
import { getPathname } from "~/i18n/routing";
import { i18nPathMapping } from "~/lib/utils";
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
 * the response carries a 1h `Cache-Control` so browsers / the edge cache it. DB
 * reads fail-soft to `[]` during the build and when no D1 binding is present.
 */
export async function GET(request: Request): Promise<NextResponse> {
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
    }));

  return NextResponse.json(markers, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
