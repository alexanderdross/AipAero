// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
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
