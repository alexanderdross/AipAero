import slug from "slug";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { captureServerError } from "~/lib/sentry";
import { MUTATIONS } from "~/server/db/queries";
import { airportApiInsertSchema, type InsertAirport } from "~/server/db/schema";

export async function POST(req: NextRequest) {
  console.info("POST /api/airports called");

  // Check if the request is authorized
  if (req.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    console.info(`Unauthorized request from IP ${ip}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bodyRaw = await req.json();
    const airports = airportApiInsertSchema.parse(bodyRaw);

    // Enrich each airport with a slug
    const enrichedAirports: InsertAirport[] = airports.map((airport) => {
      const { title, icao } = airport;
      return {
        ...airport,
        slug: !icao || icao === "" ? slug(title) : icao,
      };
    });

    if (enrichedAirports.length === 0) {
      console.info("No airports to insert");
      return NextResponse.json(
        { message: "No airports to insert" },
        { status: 200 },
      );
    }

    // Optional AIRAC/edition date (ISO "2026-06-25") forwarded by crawlers that
    // know their edition but store date-less URLs (DE). Validated loosely; an
    // out-of-shape value is ignored so it can never break the insert.
    const airacParam = req.nextUrl.searchParams.get("airac");
    const airac = /^\d{4}-\d{2}-\d{2}$/.test(airacParam ?? "")
      ? airacParam
      : null;

    // Insert the airports into the database
    await MUTATIONS.insertAirports(enrichedAirports, airac);
    return NextResponse.json(
      { message: "Airports inserted successfully" },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      // Return validation errors
      console.error("Validation error", error.issues);
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 },
      );
    }
    // Handle unexpected errors
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unknown error occurred");
    }
    void captureServerError(error, { route: "api/airports", method: "POST" });
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
