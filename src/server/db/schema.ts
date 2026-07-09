// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTableCreator,
  text,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator((name) => `aip_aero_v4_${name}`);

export const airports = createTable(
  "airports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    icao: text("icao"),
    title: text("title").notNull(),
    url: text("url").notNull(),
    type: text("type", {
      enum: ["vfr", "ifr", "heliport", "mil", "aeroport"],
    }).notNull(),
    country: text("country").notNull(),
    slug: text("slug").notNull(),
  },
  (airport) => ({
    icaoIndex: index("icao_idx").on(airport.icao),
    titleIndex: index("title_idx").on(airport.title),
    typeIndex: index("type_idx").on(airport.type),
    countryIndex: index("country_idx").on(airport.country),
    slugIndex: index("slug_idx").on(airport.slug),
  }),
);

// Helper type
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type InsertAirport = RequiredFields<
  Omit<InferInsertModel<typeof airports>, "id">,
  "slug"
>;
export type Airport = InferSelectModel<typeof airports>;
export const airportApiInsertSchema = createInsertSchema(airports)
  .omit({
    id: true,
    slug: true,
  })
  .array();

/**
 * Embedded aerodrome facts (runways / frequencies / coordinates / elevation),
 * keyed by ICAO. Populated out-of-band by the OurAirports importer (public
 * domain / CC0 data - `crawlers/import_ourairports.py`), optionally enriched at
 * request time from OpenAIP when `OPENAIP_API_KEY` is set. Kept in its own table
 * so the crawler-fed `airports` table (identity + chart link only) stays
 * untouched. `runways`/`frequencies` are JSON-encoded arrays (see the typed
 * shapes below).
 */
export const airportFacts = createTable("airport_facts", {
  icao: text("icao").primaryKey(),
  lat: real("lat"),
  lon: real("lon"),
  elevationFt: integer("elevation_ft"),
  municipality: text("municipality"), // town/city the field serves
  homeLink: text("home_link"), // official airport website, if published
  runways: text("runways"), // JSON: RunwayFact[]
  frequencies: text("frequencies"), // JSON: FrequencyFact[]
  source: text("source").notNull(), // provenance, e.g. "ourairports"
  updatedAt: integer("updated_at"), // unix seconds
});

export interface RunwayFact {
  ident: string; // e.g. "06/24"
  lengthFt: number | null;
  widthFt: number | null;
  surface: string | null; // free text (e.g. "ASP", "Asphalt", "GRASS")
}

export interface FrequencyFact {
  type: string; // free text (e.g. "TWR", "INFO", "ATIS")
  description: string | null;
  mhz: string; // e.g. "120.075"
}

export type AirportFactsRow = InferSelectModel<typeof airportFacts>;
export type InsertAirportFacts = InferInsertModel<typeof airportFacts>;
export const airportFactsApiInsertSchema =
  createInsertSchema(airportFacts).array();

/**
 * Per-country crawl timestamp - stamped each time the crawler POSTs a country's
 * airports (`MUTATIONS.insertAirports`). Powers the real "last updated" date on
 * the charts list, replacing the build-date proxy for countries that have been
 * crawled since the last deploy.
 */
export const crawlMeta = createTable("crawl_meta", {
  country: text("country").primaryKey(),
  updatedAt: integer("updated_at").notNull(), // unix seconds
});
