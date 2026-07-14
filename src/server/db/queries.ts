"server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, between, eq, asc, isNotNull, like, or, sql } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";
import { submitCountryToIndexNow } from "~/lib/indexnow";
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
// The facts columns (fuel/customs/runways, raw D1 values) are only selected by
// `airportsWithCoords` - they feed the map filters - and stay absent on the
// bounding-box "nearby" query.
// The airport-list / sitemap / airport-urls rows: a full airport row minus the
// heavy `charts` JSON (only the detail page needs charts). Keeping charts out
// of the per-country cached read is a memory guard - see `airportsByCountry`.
export type AirportListRow = Omit<Airport, "charts">;

export type AirportCoord = {
  slug: string;
  title: string;
  type: Airport["type"];
  lat: number | null;
  lon: number | null;
  // Only on `airportsWithCoords` rows: lets the coords API apply the verified
  // customs overrides (customs-overrides.ts). Optional so entries cached
  // before the column was added stay type-compatible (they just get no
  // override until the next revalidation).
  icao?: string | null;
  fuel?: string | null;
  customs?: boolean | null;
  runways?: string | null;
};

// Per-country cache tag. Every read for a country carries this tag so a crawler
// POST (always scoped to one country) can invalidate exactly that country's
// entries with a single `revalidateTag` - instead of globally busting all ~1k
// airport entries across every country on each run.
const countryTag = (country: string) => `country:${country.toUpperCase()}`;

// Per-ICAO facts tag, so the on-read write-back (see `MUTATIONS.persistAirportFacts`)
// can invalidate exactly one field's cached facts instead of busting all of them.
const factsTag = (icao: string) => `airportFacts:${icao.toUpperCase()}`;

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
  // React `cache()` = request-scoped dedupe: generateMetadata and the page
  // body both look up the same airport row in one request, and with blocking
  // metadata (htmlLimitedBots) those two calls run strictly SEQUENTIALLY -
  // without this wrapper the second call re-enters the incremental-cache
  // handler (an extra R2/D1 read on every detail-page hit). unstable_cache
  // caches across requests but does not memoize within one.
  airport: cache(function (
    slug: string,
    country: string,
    type: Airport["type"],
  ) {
    country = country.toUpperCase();
    return cachedRead<Airport | undefined>(
      "airport",
      // Case-insensitive cache key so "?edny" and "?EDNY" share one entry.
      ["airport", slug.toUpperCase(), country, type],
      ["airport", countryTag(country)],
      (db) =>
        db.query.airports.findFirst({
          where: and(
            // Manually typed detail URLs often arrive lowercased (?edny for
            // ?EDNY); SQLite compares TEXT case-sensitively, so match the slug
            // NOCASE (slugs are ASCII). The pages' canonical URL still carries
            // the stored slug casing, deduping the case variants for crawlers.
            sql`${airports.slug} = ${slug} COLLATE NOCASE`,
            eq(airports.country, country),
            eq(airports.type, type),
          ),
        }),
      undefined,
    );
  }),
  /**
   * Every type under which a slug exists in a country - backs the cross-type
   * "also available as IFR/VFR" links on the detail pages. Cached per
   * (slug, country) with the country tag, same bounded cardinality as the
   * per-airport `airport` read above (one entry per detail page).
   */
  airportTypes: cache(function (slug: string, country: string) {
    country = country.toUpperCase();
    return cachedRead<Airport["type"][]>(
      "airportTypes",
      ["airportTypes", slug.toUpperCase(), country],
      ["airportTypes", countryTag(country)],
      async (db) =>
        (
          await db
            .select({ type: airports.type })
            .from(airports)
            .where(
              and(
                sql`${airports.slug} = ${slug} COLLATE NOCASE`,
                eq(airports.country, country),
              ),
            )
        ).map((r) => r.type),
      [],
    );
  }),
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
  airportsByCountry: function (country: string) {
    // ALL chart-linked airports of a country in ONE cached, title-ordered
    // read (full rows). This is the single source for the airport-list page,
    // the sitemap and GET /api/airport-urls - callers partition by `type` in
    // JS. It replaced five per-type queries (vfr/ifr/heliport/mil/aeroport):
    // those cost every list/sitemap regeneration five tag-cache checks, five
    // D1 misses and five R2 writes, which showed up live as a multi-second
    // render delay on the streamed list content after a tag bust (PL list:
    // LCP 4.2s / Lighthouse 86, 2026-07-12). One bounded entry per country,
    // busted by the crawler POST via the country tag. ("v2" in the key: the
    // entry shape changed from slug+type-only rows to full rows - old-shaped
    // deployed entries must not be read back.)
    // Country codes are stored uppercase (the crawler upper()s them);
    // D1/SQLite compares strings case-sensitively, so normalize the
    // locale-derived country (e.g. "at") before querying.
    country = country.toUpperCase();
    return cachedRead(
      "airportsByCountry",
      ["airportsByCountry", country, "v2"],
      ["airportsByCountry", countryTag(country)],
      (db) =>
        db.query.airports.findMany({
          where: eq(airports.country, country),
          orderBy: [asc(airports.title)],
          // NEVER load `charts` here: the list page, the sitemap and
          // /api/airport-urls do not use it, and the per-field chart JSON (up
          // to 50 charts/field) is large - pulling the whole country's charts
          // into this single cached read bloated the render and broke the ES
          // list (only-map-no-list, the Error-1102 memory variant: ES alone
          // carries ~940 chart objects). Charts belong only on the detail page
          // (QUERIES.airport, one row).
          columns: { charts: false },
        }),
      [] as AirportListRow[],
    );
  },
  airportsWithCoords: function (country: string) {
    // Chart-linked airports of a country that have coordinates (joined from the
    // OurAirports facts table) - powers the map on the airport-list page. Tagged
    // with the country tag (crawler refresh), `airportFacts` (post-deploy
    // full revalidate) and `airportCoords` (busted once per importer batch -
    // see `upsertAirportFacts`) so it updates when any source changes.
    country = country.toUpperCase();
    return cachedRead(
      "airportsWithCoords",
      ["airportsWithCoords", country],
      [
        "airportsWithCoords",
        countryTag(country),
        "airportFacts",
        "airportCoords",
      ],
      (db) =>
        db
          .select({
            slug: airports.slug,
            title: airports.title,
            type: airports.type,
            icao: airports.icao,
            lat: airportFacts.lat,
            lon: airportFacts.lon,
            // Raw facts for the map filters (fuel / customs / paved runway);
            // the API route reduces them to booleans before they reach the
            // client, so the marker payload stays small.
            fuel: airportFacts.fuel,
            customs: airportFacts.customs,
            runways: airportFacts.runways,
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
  airportsNear: async function (
    country: string,
    lat: number,
    lon: number,
    latDelta: number,
    lonDelta: number,
  ): Promise<AirportCoord[]> {
    // Chart-linked fields of a country within a lat/lon bounding box - powers the
    // "nearby airfields" box on the airport-detail pages. SQLite does the box
    // filter, so the render receives only the handful of fields in range instead
    // of the whole country's coordinates (loading all of them per detail request
    // just to pick the 4 nearest was a Worker "Error 1102 - exceeded resource
    // limits" contributor on data-rich countries). Deliberately UNCACHED, like the
    // as-you-type search: a per-airport box would otherwise create unbounded cache
    // entries. Fail-soft to [] during the build / when no DB binding is present.
    // `between` on a nullable column excludes NULLs, so no explicit isNotNull.
    const db = await getDb();
    if (!db) return [];
    const c = country.toUpperCase();
    try {
      return (await db
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
            eq(airports.country, c),
            between(airportFacts.lat, lat - latDelta, lat + latDelta),
            between(airportFacts.lon, lon - lonDelta, lon + lonDelta),
          ),
        )) as AirportCoord[];
    } catch {
      return [];
    }
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
      ["airportFacts", factsTag(icao)],
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
// limit. Each airport row binds 8 columns (icao, title, url, pdf_url, charts,
// type, country, slug), so cap each INSERT at floor(100 / 8) = 12 rows
// (96 params) to stay under the D1 limit. Exceeding it fails the whole batch
// with "D1_ERROR: too many SQL variables".
const D1_MAX_BOUND_PARAMS = 100;
const INSERT_COLUMNS = 8;
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

    // IndexNow Phase 2 groundwork: snapshot the existing (type, slug) BEFORE
    // the atomic delete, so we can tell IndexNow exactly which detail pages
    // appeared or disappeared this crawl. `snapshotOk` distinguishes a genuine
    // first publish (empty result) from a read failure (skip the detail ping
    // then, so a transient error never floods IndexNow with the whole country).
    let existingKeys: { type: Airport["type"]; slug: string }[] = [];
    let snapshotOk = true;
    try {
      existingKeys = await db
        .select({ type: airports.type, slug: airports.slug })
        .from(airports)
        .where(eq(airports.country, country));
    } catch {
      snapshotOk = false;
    }

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

    // Ping IndexNow (Bing + partners) ONLY when this country's airport set
    // actually changed - the detail pages of airfields that appeared or
    // disappeared vs the snapshot (added: index now; removed: re-crawl to see
    // the 404), plus the landing + list pages that frame them. A no-op crawl
    // (same airfields, e.g. only the stand date moved) pings NOTHING: firing
    // all ~19 countries on every daily crawl flooded api.indexnow.org into
    // HTTP 429 (observed live 14.07.2026), and routine freshness is already
    // carried by the per-country sitemap lastmod. A genuine first publish has
    // an empty snapshot, so every airfield counts as "added" -> non-empty ->
    // it still pings. Off the response path via waitUntil (the crawler POST
    // returns immediately), fully fail-soft (no-op without INDEXNOW_KEY;
    // 429/503 retried with jittered backoff; see src/lib/indexnow.ts +
    // docs/indexnow-concept.md).
    const key = (a: { type: Airport["type"]; slug: string }) =>
      `${a.type}:${a.slug}`;
    const oldKeys = new Set(existingKeys.map(key));
    const newKeys = new Set(input.map(key));
    const changedDetails = snapshotOk
      ? [
          ...input.filter((a) => !oldKeys.has(key(a))),
          ...existingKeys.filter((a) => !newKeys.has(key(a))),
        ].map((a) => ({ type: a.type, slug: a.slug }))
      : [];
    if (changedDetails.length > 0) {
      try {
        const { ctx } = await getCloudflareContext({ async: true });
        ctx.waitUntil(submitCountryToIndexNow(country, changedDetails));
      } catch {
        // No Cloudflare context (build/test) - skip the ping.
      }
    }
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
    //
    // Enrichment columns use COALESCE(excluded.<col>, <existing>): a null (or
    // absent) incoming value means "don't know", never a verified absence -
    // the weekly OurAirports importer does not carry the OpenAIP fields
    // (fuel / opening hours / PPR / customs / ...) or the OSM address, and a
    // plain `excluded.*` SET wiped that persisted enrichment every Sunday,
    // silently draining e.g. the map's fuel/customs filters until each field
    // happened to be re-visited (on-read write-back). The base columns the
    // importer IS authoritative for (coords / elevation / runways / ...)
    // keep the plain overwrite so upstream refreshes land.
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
            street: sql`COALESCE(excluded.street, ${airportFacts.street})`,
            postcode: sql`COALESCE(excluded.postcode, ${airportFacts.postcode})`,
            phone: sql`COALESCE(excluded.phone, ${airportFacts.phone})`,
            fuel: sql`COALESCE(excluded.fuel, ${airportFacts.fuel})`,
            openingHours: sql`COALESCE(excluded.opening_hours, ${airportFacts.openingHours})`,
            ppr: sql`COALESCE(excluded.ppr, ${airportFacts.ppr})`,
            aerodromeType: sql`COALESCE(excluded.aerodrome_type, ${airportFacts.aerodromeType})`,
            restaurant: sql`COALESCE(excluded.restaurant, ${airportFacts.restaurant})`,
            customs: sql`COALESCE(excluded.customs, ${airportFacts.customs})`,
            source: sql`excluded.source`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    );
    const result = await db.batch(
      stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]],
    );
    // Fine-grained invalidation: the importer posts ~3k rows in ~100-row
    // batches over several minutes, and busting the global "airportFacts"
    // tag on EVERY batch sent every detail page's facts read cold for the
    // whole posting phase - measured live 2026-07-12 as TTFB 1.6s / LCP 3.3s
    // on an uninvolved detail page while an import ran. Bust only the
    // batch's own per-ICAO tags, plus `airportCoords` so the map queries see
    // new coordinates. The global "airportFacts" tag stays reserved for the
    // post-deploy POST /api/revalidate (which must bust everything at once).
    for (const row of input) {
      revalidateTag(factsTag(row.icao));
    }
    revalidateTag("airportCoords");
    return result;
  },

  // On-read write-back: persist ONE ICAO's merged facts (from getAirportFacts,
  // via `after()`) so the live OpenAIP enrichment becomes a fast DB read next
  // time. Invalidates only that field's per-ICAO tag (not the global one), so a
  // first-visit warm-up doesn't thrash every other field's cache.
  //
  // Same COALESCE-preserve on the enrichment columns as the bulk upsert above:
  // the merged row carries null for fields no source knew AT THIS REQUEST
  // (e.g. OpenAIP briefly unreachable) - that must not erase enrichment that
  // an earlier request already persisted.
  persistAirportFacts: async function (row: InsertAirportFacts) {
    const db = await getDb();
    if (!db) return;
    await db
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
          street: sql`COALESCE(excluded.street, ${airportFacts.street})`,
          postcode: sql`COALESCE(excluded.postcode, ${airportFacts.postcode})`,
          phone: sql`COALESCE(excluded.phone, ${airportFacts.phone})`,
          fuel: sql`COALESCE(excluded.fuel, ${airportFacts.fuel})`,
          openingHours: sql`COALESCE(excluded.opening_hours, ${airportFacts.openingHours})`,
          ppr: sql`COALESCE(excluded.ppr, ${airportFacts.ppr})`,
          aerodromeType: sql`COALESCE(excluded.aerodrome_type, ${airportFacts.aerodromeType})`,
          restaurant: sql`COALESCE(excluded.restaurant, ${airportFacts.restaurant})`,
          customs: sql`COALESCE(excluded.customs, ${airportFacts.customs})`,
          source: sql`excluded.source`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    revalidateTag(factsTag(row.icao));
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
