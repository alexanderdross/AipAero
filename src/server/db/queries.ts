'server-only';

import { and, eq, asc, like } from "drizzle-orm";
import { db } from "~/server/db";
import { Airport, airports } from "./schema";

export const QUERIES = {
  vfrAirports: function (country: string) {
    return db.query.airports.findMany({
      where: and(
        eq(airports.country, country),
        eq(airports.type, 'vfr')
      ),
      orderBy: [asc(airports.title)],
    });
  },
  ifrAirports: function (country: string) {
    return db.query.airports.findMany({
      where: and(
        eq(airports.country, country),
        eq(airports.type, 'ifr')
      ),
      orderBy: [asc(airports.title)],
    });
  },
  heliports: function (country: string) {
    return db.query.airports.findMany({
      where: and(
        eq(airports.country, country),
        eq(airports.type, 'heliport')
      ),
      orderBy: [asc(airports.title)],
    });
  },
  airport: function (icao: string, country: string, type: Airport['type']) {
    return db.query.airports.findFirst({
      where: and(
        eq(airports.icao, icao),
        eq(airports.country, country),
        eq(airports.type, type)
      )
    })
  },
  airports: function (search: string, country: string, type: Airport['type']) {
    return db.query.airports.findMany({
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