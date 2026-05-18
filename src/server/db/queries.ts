"server-only";

import { and, eq, asc, like } from "drizzle-orm";
import { db } from "~/server/db";
import { type InsertAirport, type Airport, airports } from "./schema";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { revalidateTag } from "next/cache";
import { log } from "next-axiom";

export const QUERIES = {
  vfrAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("vfrAirports", country);
    return await db.query.airports.findMany({
      where: and(eq(airports.country, country), eq(airports.type, "vfr")),
      orderBy: [asc(airports.title)],
    });
  },
  ifrAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("ifrAirports", country);
    return await db.query.airports.findMany({
      where: and(eq(airports.country, country), eq(airports.type, "ifr")),
      orderBy: [asc(airports.title)],
    });
  },
  heliports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("heliports", country);
    return await db.query.airports.findMany({
      where: and(eq(airports.country, country), eq(airports.type, "heliport")),
      orderBy: [asc(airports.title)],
    });
  },
  militaryAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("militaryAirports", country);
    return await db.query.airports.findMany({
      where: and(eq(airports.country, country), eq(airports.type, "mil")),
      orderBy: [asc(airports.title)],
    });
  },
  aeroportAirports: async function (country: string) {
    "use cache";
    cacheLife("hours");
    cacheTag("aeroportAirports", country);
    return await db.query.airports.findMany({
      where: and(eq(airports.country, country), eq(airports.type, "aeroport")),
      orderBy: [asc(airports.title)],
    });
  },
  airport: async function (
    slug: string,
    country: string,
    type: Airport["type"],
  ) {
    "use cache";
    cacheLife("hours");
    cacheTag("airport", slug, country, type);
    return await db.query.airports.findFirst({
      where: and(
        eq(airports.slug, slug),
        eq(airports.country, country),
        eq(airports.type, type),
      ),
    });
  },
  airports: async function (
    search: string,
    country: string,
    type: Airport["type"],
  ) {
    "use cache";
    cacheLife("hours");
    cacheTag("airports", search, country, type);
    return await db.query.airports.findMany({
      limit: 5,
      where: and(
        eq(airports.country, country),
        eq(airports.type, type),
        like(airports.title, `%${search}%`),
      ),
      orderBy: [asc(airports.title)],
    });
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
