"server-only";

import { and, eq, asc, isNotNull, like, or, sql } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb, type DB } from "~/server/db";
import {
  type InsertAirport,
  type Airport,
  type AirportFactsRow,
  type InsertAirportFacts,
  airports,
  airportFacts,
  crawlMeta,
} from "./schema";

// Cache lifetime for the read queries (seconds). The AIP data only changes when
// the crawler POSTs new data, which invalidates the affected country on-demand
// via `revalidateTag` (see MUTATIONS below). So the time-based revalidate only
// needs to be a safety net, not a freshness mechanism - a short window (the old
// 1h) just rewrites unchanged entries to the cache hourly for nothing. 24h keeps
// writes low while still bounding staleness if an on-demand invalidation is ever
// missed.
const REVALIDATE_SECONDS = 60 * 60 * 24;

// A chart-linked airport with map coordinates (see `airportsWithCoords`).
export type AirportCoord = {
  slug: string;
  title: string;
  type: Airport["type"];
  lat: number | null;
  lon: number | null;
};

// Per-country cache tag. Every read for a country carries this tag so a crawler
// POST (always scoped to one country) can invalidate exactly that country's
// entries with a single `revalidateTag` - instead of globally busting all ~1k
// airport entries across every country on each run.
const countryTag = (country: string) => `country:${country.toUpperCase()}`;

// During `next build` the OpenNext adapter exposes a *local* (miniflare) D1
// binding that has no data (and, in CI, no schema). We must not fail the build
// on it - static pages/sitemaps prerender with empty results and revalidate at
// runtime (and whenever the crawler POST triggers `revalidateTag`). At runtime
// on a real Worker the DB is migrated and populated, so we let errors surface.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

// Build-time cache entries are (necessarily) EMPTY - the build has no DB. Every
// deploy seeds them into the incremental cache (R2), where a 24h TTL would keep
// serving empty airport lists until the next crawler POST happens to bust the
// country tag. Stamp build-written entries with a 1h TTL instead: instant
// freshness after a deploy comes from the CD workflow's POST /api/revalidate;
// this TTL only bounds staleness if that call is unavailable. Do not go much
// lower - a page's ISR interval becomes the MINIMUM of its route revalidate
// and every cache TTL used during the build render, so a tiny value here would
// make all prerendered pages rewrite (R2 writes) that often, forever.
// (We must keep going THROUGH unstable_cache during the build - bypassing it
// would strip the country tags off the prerendered pages and break the
// on-demand revalidateTag flow.)
const BUILD_SEED_REVALIDATE_SECONDS = 60 * 60;

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
        console.error(
          `DB read '${label}' failed at runtime:`,
          err instanceof Error ? (err.stack ?? err.message) : String(err),
        );
        throw err;
      }
    },
    keyParts,
    {
      tags,
      revalidate: IS_BUILD ? BUILD_SEED_REVALIDATE_SECONDS : REVALIDATE_SECONDS,
    },
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
      ["vfrAirports", countryTag(country)],
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
      ["ifrAirports", countryTag(country)],
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
      ["heliports", countryTag(country)],
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
      ["militaryAirports", countryTag(country)],
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
      ["aeroportAirports", countryTag(country)],
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
      ["airport", countryTag(country)],
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
  airports: async function (
    search: string,
    country: string,
    type: Airport["type"],
  ) {
    country = country.toUpperCase();
    // Intentionally NOT cached. This backs the as-you-type search box, which
    // fires one query per keystroke. Caching per unique search string created a
    // fresh incremental-cache entry per prefix ("f", "fr", "fri", …) with almost
    // no reuse - a major source of needless cache writes. The query is a cheap,
    // title-indexed D1 read (LIMIT 5), so hit D1 directly instead.
    const db = await getDb();
    if (!db) return [] as Airport[];
    return db.query.airports.findMany({
      limit: 5,
      where: and(
        eq(airports.country, country),
        eq(airports.type, type),
        // Match the query against the title OR the ICAO column. Titles usually
        // embed the ICAO (e.g. "Wien-Schwechat LOWW"), but matching `icao`
        // directly makes ICAO search robust even when it isn't in the title.
        // Both columns are indexed; the LIMIT 5 keeps it cheap.
        or(
          like(airports.title, `%${search}%`),
          like(airports.icao, `%${search}%`),
        ),
      ),
      orderBy: [asc(airports.title)],
    });
  },
  airportsGlobal: async function (search: string) {
    // Cross-country as-you-type search (title OR ICAO), spanning every country
    // and type. Not cached, same rationale as `airports` above. LIMIT 8 keeps
    // it cheap; both matched columns are indexed.
    const db = await getDb();
    if (!db) return [] as Airport[];
    return db.query.airports.findMany({
      limit: 8,
      where: or(
        like(airports.title, `%${search}%`),
        like(airports.icao, `%${search}%`),
      ),
      orderBy: [asc(airports.title)],
    });
  },
  airportsWithCoords: function (country: string) {
    // Chart-linked airports of a country that have coordinates (joined from the
    // OurAirports facts table) - powers the map on the airport-list page. Tagged
    // with both the country tag (crawler refresh) and `airportFacts` (importer
    // refresh) so it updates when either source changes.
    country = country.toUpperCase();
    return cachedRead(
      "airportsWithCoords",
      ["airportsWithCoords", country],
      ["airportsWithCoords", countryTag(country), "airportFacts"],
      (db) =>
        db
          .select({
            slug: airports.slug,
            title: airports.title,
            type: airports.type,
            lat: airportFacts.lat,
            lon: airportFacts.lon,
          })
          .from(airports)
          .innerJoin(airportFacts, eq(airports.icao, airportFacts.icao))
          .where(
            and(
              eq(airports.country, country),
              isNotNull(airportFacts.lat),
              isNotNull(airportFacts.lon),
            ),
          ),
      [] as AirportCoord[],
    );
  },
  crawlUpdatedAt: function (country: string) {
    // Unix-seconds timestamp of the last crawler POST for this country (null if
    // never crawled). Tagged with the country tag so a fresh POST busts it.
    country = country.toUpperCase();
    return cachedRead<number | null>(
      "crawlUpdatedAt",
      ["crawlUpdatedAt", country],
      ["crawlUpdatedAt", countryTag(country)],
      (db) =>
        db
          .select({ updatedAt: crawlMeta.updatedAt })
          .from(crawlMeta)
          .where(eq(crawlMeta.country, country))
          .limit(1)
          .then((rows) => rows[0]?.updatedAt ?? null),
      null,
    );
  },
  airportFacts: function (icao: string) {
    // Embedded aerodrome facts by ICAO (OurAirports base, imported into D1).
    // Cached with a single global tag - the importer refreshes all rows at once.
    return cachedRead<AirportFactsRow | undefined>(
      "airportFacts",
      ["airportFacts", icao],
      ["airportFacts"],
      (db) =>
        db
          .select()
          .from(airportFacts)
          .where(eq(airportFacts.icao, icao))
          .limit(1)
          .then((rows) => rows[0]),
      undefined,
    );
  },
};

// Cloudflare D1 caps bound parameters at 100 per query - far below SQLite's own
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
    // Stamp this country's crawl time (unix seconds) in the same atomic batch,
    // so the charts list can show a real "last updated" per country. Runs only
    // at runtime (the crawler POST), where `Date` is available.
    const crawledAt = Math.floor(Date.now() / 1000);
    const crawlStmt = db
      .insert(crawlMeta)
      .values({ country, updatedAt: crawledAt })
      .onConflictDoUpdate({
        target: crawlMeta.country,
        set: { updatedAt: sql`excluded.updated_at` },
      });
    const statements = [deleteStmt, ...insertStmts, crawlStmt];
    const result = await db.batch(
      statements as [
        (typeof statements)[number],
        ...(typeof statements)[number][],
      ],
    );

    // Invalidate only this country's cached reads. Every read is tagged with
    // `country:<CC>` (see `countryTag`), and a crawler POST always carries a
    // single country's data - so one tag busts exactly the affected lists +
    // airport-detail entries, leaving the other countries' caches warm. (The
    // previous code revalidated 7 global tags, invalidating all ~1k entries
    // across every country on every run.)
    revalidateTag(countryTag(country));
    return result;
  },
  upsertAirportFacts: async function (input: InsertAirportFacts[]) {
    if (!input[0]) return;
    const db = await getDb();
    if (!db) {
      throw new Error("D1 database binding is unavailable");
    }
    // Per-row upsert keyed on ICAO (each row binds ~19 params, well under the
    // D1 100-param limit). Uses `excluded.*` so re-imports overwrite in place
    // instead of wiping the table between paginated importer batches.
    const stmts = input.map((row) =>
      db
        .insert(airportFacts)
        .values(row)
        .onConflictDoUpdate({
          target: airportFacts.icao,
          set: {
            lat: sql`excluded.lat`,
            lon: sql`excluded.lon`,
            elevationFt: sql`excluded.elevation_ft`,
            municipality: sql`excluded.municipality`,
            homeLink: sql`excluded.home_link`,
            runways: sql`excluded.runways`,
            frequencies: sql`excluded.frequencies`,
            street: sql`excluded.street`,
            postcode: sql`excluded.postcode`,
            phone: sql`excluded.phone`,
            fuel: sql`excluded.fuel`,
            openingHours: sql`excluded.opening_hours`,
            ppr: sql`excluded.ppr`,
            aerodromeType: sql`excluded.aerodrome_type`,
            restaurant: sql`excluded.restaurant`,
            customs: sql`excluded.customs`,
            source: sql`excluded.source`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    );
    const result = await db.batch(
      stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]],
    );
    revalidateTag("airportFacts");
    return result;
  },

  // Bust every given country's cached reads (and, via the tag cache, the
  // prerendered pages carrying those tags). Used by POST /api/revalidate -
  // the CD workflow calls it once after each deploy, because a deploy seeds
  // the incremental cache with the build's EMPTY prerenders (the build has
  // no DB) which would otherwise be served until the next crawler POST.
  revalidateCountries: function (countries: string[]): string[] {
    const tags = countries.map((c) => countryTag(c));
    for (const tag of tags) {
      revalidateTag(tag);
    }
    return tags;
  },
};
