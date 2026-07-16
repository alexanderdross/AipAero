import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { API_CORS, apiKeyError } from "~/lib/api-auth";
import { getDb } from "~/server/db";
import { QUERIES } from "~/server/db/queries";
import { airports } from "~/server/db/schema";

/** Parse a JSON text column, failing soft to `fallback`. */
function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Public read-only data API - a single aerodrome by ICAO.
 *
 * `GET /api/v1/airport/{ICAO}` (Bearer `PUBLIC_API_KEY`) returns the aerodrome's
 * AIP/chart links (url, pdfUrl, the full captured `charts` list) merged with its
 * structured facts (coordinates, elevation, runways, frequencies, fuel, opening
 * hours, customs, ...) from the D1 `airport_facts` table. 404 when the ICAO is
 * not held. DB reads fail soft.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ icao: string }> },
): Promise<Response> {
  const err = apiKeyError(req.headers.get("Authorization"), env.PUBLIC_API_KEY);
  if (err) {
    return NextResponse.json(
      { error: err.error },
      { status: err.status, headers: API_CORS },
    );
  }

  const { icao: icaoParam } = await ctx.params;
  const icao = icaoParam.toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    return NextResponse.json(
      { error: "Invalid ICAO code" },
      { status: 400, headers: API_CORS },
    );
  }

  const db = await getDb();
  const row = db
    ? await db.query.airports
        .findFirst({ where: eq(airports.icao, icao) })
        .catch(() => undefined)
    : undefined;
  if (!row) {
    return NextResponse.json(
      { error: "Aerodrome not found" },
      { status: 404, headers: API_CORS },
    );
  }

  const facts = await QUERIES.airportFacts(icao).catch(() => undefined);

  const body = {
    icao: row.icao,
    title: row.title,
    type: row.type,
    country: row.country,
    slug: row.slug,
    url: row.url,
    pdfUrl: row.pdfUrl,
    charts: parseJson<{ name: string; url: string }[]>(row.charts, []),
    facts: facts
      ? {
          lat: facts.lat,
          lon: facts.lon,
          elevationFt: facts.elevationFt,
          municipality: facts.municipality,
          website: facts.homeLink,
          phone: facts.phone,
          address: {
            street: facts.street,
            postcode: facts.postcode,
          },
          runways: parseJson<unknown[]>(facts.runways, []),
          frequencies: parseJson<unknown[]>(facts.frequencies, []),
          fuel: parseJson<string[]>(facts.fuel, []),
          openingHours: facts.openingHours,
          ppr: facts.ppr,
          customs: facts.customs,
          restaurant: facts.restaurant,
          updatedAt: facts.updatedAt,
        }
      : null,
  };

  return NextResponse.json(body, {
    headers: {
      ...API_CORS,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { headers: API_CORS });
}
