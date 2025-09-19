import { log } from "next-axiom";
import slug from 'slug';
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { MUTATIONS } from "~/server/db/queries";
import { airportApiInsertSchema, InsertAirport } from "~/server/db/schema";

export async function POST(req: NextRequest) {
  log.info('POST /api/airports called');

  // Check if the request is authorized
  if (req.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    log.info(`Unauthorized request from IP ${ip}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyRaw = await req.json();
    const airports = airportApiInsertSchema.parse(bodyRaw);

    // Enrich each airport with a slug
    const enrichedAirports: InsertAirport[] = airports.map((airport) => {
      const { title, icao } = airport;
      return {
        ...airport,
        slug: (!icao || icao === '') ? slug(title) : icao,
      };
    });

    if (enrichedAirports.length === 0) {
      log.info('No airports to insert');
      return NextResponse.json({ message: 'No airports to insert' }, { status: 200 });
    }

    // Insert the airports into the database
    await MUTATIONS.insertAirports(enrichedAirports);
    return NextResponse.json({ message: 'Airports inserted successfully' }, { status: 201 });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      // Return validation errors
      log.error('Validation error', error.errors);
      return NextResponse.json(
        { message: 'Validation error', errors: error.errors },
        { status: 400 }
      );
    }
    // Handle unexpected errors
    if (error instanceof Error) {
      log.error(error.message);
    } else {
      log.error('An unknown error occurred');
    }
    return NextResponse.json(
      { message: 'Something went wrong' },
      { status: 500 }
    );
  }
}