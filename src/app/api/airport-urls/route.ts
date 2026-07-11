import { NextResponse } from "next/server";
import { getPathname, routing } from "~/i18n/routing";
import { i18nPathMapping } from "~/lib/utils";
import { withEdgeCache } from "~/server/edge-cache";
import { QUERIES } from "~/server/db/queries";

/**
 * Detail-page URLs of a locale's airports - the download set behind the
 * explicit "make <country> available offline" country pack (PWA concept
 * Phase 4, `save-country-offline-button.tsx`).
 *
 * Served as a small standalone endpoint (like /api/airport-coords) so the
 * URL list is only fetched on demand when the pilot clicks the download
 * button - serialising hundreds of URLs into the airport-list server render
 * would weigh down that already-heavy page for every visitor.
 *
 * Reads go through the cached `QUERIES.airportsByCountry` (per-country tag),
 * and the response carries a 1h `Cache-Control` + the edge cache. DB reads
 * fail-soft to `[]` - the button then simply has nothing to download.
 */
export async function GET(request: Request): Promise<Response> {
  return withEdgeCache(request, () => handleUrls(request));
}

async function handleUrls(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? "";
  if (!(routing.locales as readonly string[]).includes(locale)) {
    return NextResponse.json([]);
  }
  const country = locale.split("-")[0]!;

  const rows = await QUERIES.airportsByCountry(country).catch(() => []);
  const urls = rows.map((a) => {
    const pathname = getPathname({ href: i18nPathMapping[a.type], locale });
    // Trailing-slash canonical form (`trailingSlash: true`): the cached key
    // must equal the navigation URL the service worker looks up offline.
    const withSlash = pathname.endsWith("/") ? pathname : pathname + "/";
    return `${withSlash}?${a.slug}`;
  });

  return NextResponse.json(urls, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
