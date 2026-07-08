import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { MUTATIONS } from "~/server/db/queries";
import { airportFactsApiInsertSchema } from "~/server/db/schema";

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
