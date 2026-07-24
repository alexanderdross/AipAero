import { NextResponse } from "next/server";
import { env } from "~/env";
import { API_CORS, authorizeApiRequest } from "~/lib/api-auth";
import { liveCountries } from "~/lib/utils";
import { QUERIES } from "~/server/db/queries";

/**
 * Public read-only data API - a country's aerodrome index.
 *
 * `GET /api/v1/airports/{country}` (Bearer `PUBLIC_API_KEY`) returns every
 * chart-linked aerodrome AIP:Aero holds for a live country, as structured JSON:
 * ICAO, title (`<name> <ICAO>`), type, slug, the official AIP/chart `url` and
 * the direct chart `pdfUrl` when captured. Reuses the same cached, per-country
 * read the website uses (`QUERIES.airportsByCountry`), so it adds no DB load
 * beyond the shared cache; DB reads fail soft to an empty list.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ country: string }> },
): Promise<Response> {
  const err = await authorizeApiRequest(
    req.headers.get("Authorization"),
    env.PUBLIC_API_KEY,
    (hash) => QUERIES.apiKeyActive(hash),
  );
  if (err) {
    return NextResponse.json(
      { error: err.error },
      { status: err.status, headers: API_CORS },
    );
  }

  const { country } = await ctx.params;
  const cc = country.toLowerCase();
  if (!liveCountries.includes(cc)) {
    return NextResponse.json(
      { error: "Unknown or unavailable country" },
      { status: 404, headers: API_CORS },
    );
  }

  const rows = await QUERIES.airportsByCountry(cc).catch(() => []);
  const airports = rows.map((a) => ({
    icao: a.icao,
    title: a.title,
    type: a.type,
    slug: a.slug,
    url: a.url,
    pdfUrl: a.pdfUrl,
  }));

  return NextResponse.json(
    { country: cc, count: airports.length, airports },
    {
      headers: {
        ...API_CORS,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}

export function OPTIONS(): Response {
  return new Response(null, { headers: API_CORS });
}
