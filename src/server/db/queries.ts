'server-only';

import { and, eq, asc, like } from "drizzle-orm";
import { db } from "~/server/db";
import { Airport, airports } from "./schema";

export const QUERIES = {
  vfrAirports: async function (country: string) {
    "use cache"
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