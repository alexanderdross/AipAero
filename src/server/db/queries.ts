"server-only";

import { and, eq, asc, like } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb, type DB } from "~/server/db";
import { type InsertAirport, type Airport, airports } from "./schema";

// Cache lifetime for the read queries (seconds). Matches the previous
// `cacheLife("hours")` used with the `"use cache"` directive, which the
// Cloudflare/OpenNext adapter does not yet support — so we use the classic
// `unstable_cache` API, which OpenNext supports and which keeps `revalidateTag`
// invalidation working unchanged.
const REVALIDATE_SECONDS = 60 * 60;

// During `next build` the OpenNext adapter exposes a *local* (miniflare) D1
// binding that has no data (and, in CI, no schema). We must not fail the build
// on it — static pages/sitemaps prerender with empty results and revalidate at
// runtime (and whenever the crawler POST triggers `revalidateTag`). At runtime
// on a real Worker the DB is migrated and populated, so we let errors surface.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

// Wrap a read in `unstable_cache` with the given tags.
function cachedRead<T>(
  label: string,
  keyParts: string[],
  tags: string[],
  run: (db: DB) => Promise<T>,
  fallback: T,
): Promise<T> {
  return unstable_cache(
    async () => {
      const db = await getDb();
      if (!db) {
        console.warn(
          `DB unavailable during ${label}; returning empty result so the build/cache can proceed`,
        );
        return fallback;
      }
      try {
        return await run(db);
      } catch (err) {
        if (IS_BUILD) {
          console.warn(
            `DB read '${label}' failed during build; returning empty result (revalidated at runtime)`,
            err instanceof Error ? err.message : String(err),
          );
          return fallback;
        }
        throw err;
      }
    },
    keyParts,
    { tags, revalidate: REVALIDATE_SECONDS },
  )();
}

export const QUERIES = {
  vfrAirports: function (country: string) {
    // Country codes are stored uppercase (the crawler upper()s them). D1/SQLite
    // compares strings case-sensitively (unlike the old MySQL ci collation), so
    // normalize the locale-derived country (e.g. "at") before querying.
    country = country.toUpperCase();
    return cachedRead(
      "vfrAirports",
      ["vfrAirports", country],
      ["vfrAirports", country],
      (db) =>
        db.query.airports.findMany({
          where: and(eq(airports.country, country), eq(airports.type, "vfr")),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  ifrAirports: function (country: string) {
    country = country.toUpperCase();
    return cachedRead(
      "ifrAirports",
      ["ifrAirports", country],
      ["ifrAirports", country],
      (db) =>
        db.query.airports.findMany({
          where: and(eq(airports.country, country), eq(airports.type, "ifr")),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  heliports: function (country: string) {
    country = country.toUpperCase();
    return cachedRead(
      "heliports",
      ["heliports", country],
      ["heliports", country],
      (db) =>
        db.query.airports.findMany({
          where: and(
            eq(airports.country, country),
            eq(airports.type, "heliport"),
          ),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  militaryAirports: function (country: string) {
    country = country.toUpperCase();
    return cachedRead(
      "militaryAirports",
      ["militaryAirports", country],
      ["militaryAirports", country],
      (db) =>
        db.query.airports.findMany({
          where: and(eq(airports.country, country), eq(airports.type, "mil")),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  aeroportAirports: function (country: string) {
    country = country.toUpperCase();
    return cachedRead(
      "aeroportAirports",
      ["aeroportAirports", country],
      ["aeroportAirports", country],
      (db) =>
        db.query.airports.findMany({
          where: and(
            eq(airports.country, country),
            eq(airports.type, "aeroport"),
          ),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  airport: function (slug: string, country: string, type: Airport["type"]) {
    country = country.toUpperCase();
    return cachedRead<Airport | undefined>(
      "airport",
      ["airport", slug, country, type],
      ["airport", slug, country, type],
      (db) =>
        db.query.airports.findFirst({
          where: and(
            eq(airports.slug, slug),
            eq(airports.country, country),
            eq(airports.type, type),
          ),
        }),
      undefined,
    );
  },
  airports: function (search: string, country: string, type: Airport["type"]) {
    country = country.toUpperCase();
    return cachedRead(
      "airports",
      ["airports", search, country, type],
      ["airports", search, country, type],
      (db) =>
        db.query.airports.findMany({
          limit: 5,
          where: and(
            eq(airports.country, country),
            eq(airports.type, type),
            like(airports.title, `%${search}%`),
          ),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
};

// Cloudflare D1 caps bound parameters at 100 per query — far below SQLite's own
// limit. Each airport row binds 6 columns (icao, title, url, type, country,
// slug), so cap each INSERT at floor(100 / 6) = 16 rows (96 params) to stay
// under the D1 limit. Exceeding it fails the whole batch with
// "D1_ERROR: too many SQL variables".
const D1_MAX_BOUND_PARAMS = 100;
const INSERT_COLUMNS = 6;
const INSERT_CHUNK_SIZE = Math.floor(D1_MAX_BOUND_PARAMS / INSERT_COLUMNS);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export const MUTATIONS = {
  insertAirports: async function (input: InsertAirport[]) {
    if (!input[0]) {
      console.warn("No airports to insert");
      return;
    }
    const db = await getDb();
    if (!db) {
      throw new Error("D1 database binding is unavailable");
    }
    const country = input[0].country;

    // Atomic delete-then-insert via D1's batch (D1 has no interactive
    // transactions). Without atomicity a crash between the delete and the
    // insert would leave the country with zero airports until the next crawl.
    const deleteStmt = db.delete(airports).where(eq(airports.country, country));
    const insertStmts = chunk(input, INSERT_CHUNK_SIZE).map((rows) =>
      db.insert(airports).values(rows),
    );
    const statements = [deleteStmt, ...insertStmts];
    const result = await db.batch(
      statements as [
        (typeof statements)[number],
        ...(typeof statements)[number][],
      ],
    );

    // Invalidate the cache tags
    revalidateTag("vfrAirports");
    revalidateTag("ifrAirports");
    revalidateTag("heliports");
    revalidateTag("militaryAirports");
    revalidateTag("aeroportAirports");
    revalidateTag("airport");
    revalidateTag("airports");
    return result;
  },
};
