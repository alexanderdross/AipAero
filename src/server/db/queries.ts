"server-only";

import { and, eq, asc, like } from "drizzle-orm";
import { db } from "~/server/db";
import { type InsertAirport, type Airport, airports } from "./schema";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { revalidateTag } from "next/cache";
import { log } from "next-axiom";

// Network errors that mean "MySQL host is unreachable from this environment"
// — e.g. Vercel's build sandbox trying to reach a private/Docker-bridge IP.
// We treat these as soft failures during reads so static generation can finish
// with empty results; the page will be revalidated once the DB is reachable.
// Schema errors, bad SQL, permission denials, etc. are NOT swallowed.
const NETWORK_ERROR_CODES = new Set([
  "EHOSTUNREACH",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENETUNREACH",
  "ENOTFOUND",
]);

function isNetworkError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) return true;
  const cause = (err as { cause?: unknown }).cause;
  return cause !== undefined && isNetworkError(cause);
}

async function safeRead<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isNetworkError(err)) {
      log.warn(
        `DB unreachable during ${label}; returning empty result so the build/cache can proceed`,
        { error: err instanceof Error ? err.message : String(err) },
      );
      return fallback;
    }
    throw err;
  }
}

export const QUERIES = {
  vfrAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("vfrAirports", country);
    return await safeRead(
      "vfrAirports",
      () =>
        db.query.airports.findMany({
          where: and(eq(airports.country, country), eq(airports.type, "vfr")),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  ifrAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("ifrAirports", country);
    return await safeRead(
      "ifrAirports",
      () =>
        db.query.airports.findMany({
          where: and(eq(airports.country, country), eq(airports.type, "ifr")),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  heliports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("heliports", country);
    return await safeRead(
      "heliports",
      () =>
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
  militaryAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("militaryAirports", country);
    return await safeRead(
      "militaryAirports",
      () =>
        db.query.airports.findMany({
          where: and(eq(airports.country, country), eq(airports.type, "mil")),
          orderBy: [asc(airports.title)],
        }),
      [] as Airport[],
    );
  },
  aeroportAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("aeroportAirports", country);
    return await safeRead(
      "aeroportAirports",
      () =>
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
  airport: async function (
    slug: string,
    country: string,
    type: Airport["type"],
  ) {
    "use cache";
    cacheLife("hours");
    cacheTag("airport", slug, country, type);
    return await safeRead<Airport | undefined>(
      "airport",
      () =>
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
    "use cache";
    cacheLife("hours");
    cacheTag("airports", search, country, type);
    return await safeRead(
      "airports",
      () =>
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

export const MUTATIONS = {
  insertAirports: async function (input: InsertAirport[]) {
    if (!input[0]) {
      log.warn("No airports to insert");
      return;
    }
    const country = input[0].country;
    // Atomic delete-then-insert. Without a transaction a process kill or
    // network blip between the two statements leaves the country with zero
    // airports until the next crawl.
    const result = await db.transaction(async (tx) => {
      await tx.delete(airports).where(eq(airports.country, country)).execute();
      return await tx.insert(airports).values(input).execute();
    });
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
