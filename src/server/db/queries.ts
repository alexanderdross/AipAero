'server-only';

import { and, eq, asc, like } from "drizzle-orm";
import { db } from "~/server/db";
import { InsertAirport, Airport, airports } from "./schema";
import { unstable_cacheLife as cacheLife } from 'next/cache';

export const QUERIES = {
  vfrAirports: async function (country: string) {
    "use cache"
    cacheLife('hours');
    return await db.query.airports.findMany({
      where: and(
        eq(airports.country, country),
        eq(airports.type, 'vfr')
      ),
      orderBy: [asc(airports.title)],
    });
  },
  ifrAirports: async function (country: string) {
    "use cache"
    cacheLife('hours');
    return await db.query.airports.findMany({
      where: and(
        eq(airports.country, country),
        eq(airports.type, 'ifr')
      ),
      orderBy: [asc(airports.title)],
    });
  },
  heliports: async function (country: string) {
    "use cache"
    cacheLife('hours');
    return await db.query.airports.findMany({
      where: and(
        eq(airports.country, country),
        eq(airports.type, 'heliport')
      ),
      orderBy: [asc(airports.title)],
    });
  },
  airport: async function (slug: string, country: string, type: Airport['type']) {
    "use cache"
    cacheLife('hours');
    return await db.query.airports.findFirst({
      where: and(
        eq(airports.slug, slug),
        eq(airports.country, country),
        eq(airports.type, type)
      )
    })
  },
  airports: async function (search: string, country: string, type: Airport['type']) {
    "use cache"
    cacheLife('hours');
    return await db.query.airports.findMany({
      limit: 5,
      where: and(
        eq(airports.country, country),
        eq(airports.type, type),
        like(airports.title, `%${search}%`)
      ),
      orderBy: [asc(airports.title)],
    });
  }
};

export const MUTATIONS = {
  insertAirports: async function (input: {
    airports: InsertAirport[],
    country: string
  }) {
    await db.delete(airports).where(eq(airports.country, input.country)).execute();
    return await db.insert(airports).values(input.airports).execute();
  },
};