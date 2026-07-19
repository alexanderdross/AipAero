import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { MUTATIONS, QUERIES } from "~/server/db/queries";
import { airportFactsApiInsertSchema } from "~/server/db/schema";

// Hours-only ingest (PATCH): the eAIP AD 2.3 crawler POSTs just the structured
// operation hours per ICAO. Kept separate from the full-row POST so it never
// nulls the base columns (coords / runways) - see MUTATIONS.upsertAirportHours.
const airportHoursSchema = z
  .object({
    icao: z.string().regex(/^[A-Z]{4}$/),
    hoursStructured: z.string().nullable(), // JSON StructuredHours (or null)
    hoursSource: z.enum(["eaip", "openaip"]),
  })
  .array();

// Read side (same Bearer auth): the OpenAIP backfill importer
// (crawlers/import_openaip_backfill.py) GETs a worklist of ICAOs to query
// OpenAIP for. Two scopes:
//  - default (facts): ICAOs with NO facts row yet - the fields OurAirports
//    never carried (hospital heliports / small ULM strips), so it only fills
//    those instead of all ~3k.
//  - ?scope=hours: ICAOs with no structured operation hours yet
//    (`hours_structured IS NULL`) - so OpenAIP hours reach every country, not
//    only the eurocontrol AD 2.3 ones. eAIP-sourced hours are non-null and thus
//    excluded (never re-fetched; the upsert precedence keeps eAIP winning).
// Uncached query, invoked at most weekly from the importer.
export async function GET(req: NextRequest) {
  if (req.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = new URL(req.url).searchParams.get("scope");
  const missing =
    scope === "hours"
      ? await QUERIES.airportsMissingHours()
      : await QUERIES.airportsMissingFacts();
  return NextResponse.json({ count: missing.length, missing });
}

// Ingest endpoint for the OurAirports facts importer (crawlers/import_ourairports.py).
// Same Bearer-token auth as /api/airports. Body: an array of facts rows
// ({ icao, lat, lon, elevationFt, runways, frequencies, source, updatedAt });
// `runways`/`frequencies` are JSON-encoded strings. Rows are upserted by ICAO.
export async function POST(req: NextRequest) {
  if (req.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const facts = airportFactsApiInsertSchema.parse(await req.json());
    if (facts.length === 0) {
      return NextResponse.json({ message: "No facts to insert" });
    }
    await MUTATIONS.upsertAirportFacts(facts);
    return NextResponse.json(
      { message: `Upserted ${facts.length} airport facts` },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 },
      );
    }
    console.error(error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

// Hours-only upsert (eAIP AD 2.3 crawler). Same Bearer auth; touches only the
// structured-hours columns (never the base coords/runways).
export async function PATCH(req: NextRequest) {
  if (req.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = airportHoursSchema.parse(await req.json());
    if (rows.length === 0) {
      return NextResponse.json({ message: "No hours to upsert" });
    }
    await MUTATIONS.upsertAirportHours(rows);
    return NextResponse.json(
      { message: `Upserted hours for ${rows.length} airports` },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 },
      );
    }
    console.error(error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
