'server-only';

import { and, eq, asc } from "drizzle-orm";
import { db } from "~/server/db";
import { airports } from "./schema";

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
  airport: function (icao: string, country: string) {
    return db.query.airports.findFirst({
      where: and(
        eq(airports.icao, icao),
        eq(airports.country, country)
      )
    })
  }
};