// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { 
  type InferInsertModel, 
  InferSelectModel, 
  sql, 
  type SQL 
} from "drizzle-orm";
import {
  type AnyMySqlColumn,
  bigint,
  index,
  mysqlEnum,
  mysqlTableCreator,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = mysqlTableCreator((name) => `aip_aero_v3_${name}`);

export const airports = createTable(
  "airports",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    icao: varchar("icao", { length: 4 }),
    title: varchar("title", { length: 256 }).notNull(),
    url: varchar("url", { length: 512 }).notNull(),
    type: mysqlEnum('type', ['vfr', 'ifr', 'heliport']).notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    slug: varchar("slug", { length: 256 }).notNull(),
  },
  (airport) => ({
    icaoIndex: index("icao_idx").on(airport.icao),
    titleIndex: index("title_idx").on(airport.title),
    typeIndex: index("type_idx").on(airport.type),
    countryIndex: index("country_idx").on(airport.country),
    slugIndex: index("slug_idx").on(airport.slug),
  })
);

// See https://orm.drizzle.team/docs/guides/unique-case-insensitive-email#mysql
export function lower(input: AnyMySqlColumn): SQL {
  return sql`lower(${input})`;
}

export type InsertAirport = InferInsertModel<typeof airports>;
export type Airport = InferSelectModel<typeof airports>;