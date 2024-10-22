'use server';

import { and, asc, eq, like, or } from "drizzle-orm";
import { db } from "~/server/db";
import { airports } from "~/server/db/schema";

export async function findAirport(icao: string, countryCode: string, type: "vfr" | "ifr" | "heliport") {
  // Get airport data
  const data = await db.query.airports.findFirst({
    columns: {
      title: true,
      icao: true,
      url: true
    },
    where: and(
      eq(airports.country, countryCode),
      eq(airports.type, type),
      eq(airports.icao, icao)
    ),
  });
  return data;
}

export async function findAirports(query: string, countryCode: string, type: "vfr" | "ifr" | "heliport") {
  if (query.length === 0) {
    return [];
  }
  const posts = await db.query.airports.findMany({
    columns: {
      title: true,
      icao: true,
      url: true
    },
    limit: 5,
    where: and(
      eq(airports.country, countryCode),
      eq(airports.type, type),
      or(
        like(airports.title, `%${query}%`),
        like(airports.icao, `%${query}%`)
      )
    ),
    orderBy: [asc(airports.title)],
  });
  return posts;
}