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
    // Direct link to the exact approach-chart PDF, where the crawler could
    // capture one (chart-PDF plan Stage 2, docs/chart-pdf-plan.md). Nullable:
    // sources whose crawler stores an index/frameset page leave it null and
    // the site falls back to `url` (+ isPdfUrl). Never required.
    pdfUrl: text("pdf_url"),
    // FULL list of the source's chart PDFs for this airport - JSON array of
    // {name, url} (name = the source's own designation, e.g. "AD 2.EGPD-2-1"
    // or "EHAM-VFR-PROC"), capped by the crawlers. `pdfUrl` stays the primary
    // pick for the chart box's main link; this feeds the "all charts" list.
    charts: text("charts"),
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
  // Persisted enrichment so the detail page reads values from D1 instead of
  // fetching them live per request. Populated by the importer (OpenAIP +
  // OpenStreetMap); the live OpenAIP / Nominatim fetches remain a fallback for
  // ICAOs not yet backfilled. The postal address comes from OSM/Nominatim; the
  // rest from OpenAIP.
  street: text("street"), // street + house number (OSM)
  postcode: text("postcode"), // postal code (OSM)
  phone: text("phone"), // contact phone (OSM)
  fuel: text("fuel"), // JSON: string[] fuel labels (OpenAIP)
  openingHours: text("opening_hours"), // hours of operation, human display string
  // Structured, queryable operation hours - JSON StructuredHours (7 days), see
  // src/lib/opening-hours.ts. Powers the "open now / open until X" detail badge
  // and map filter. `hoursSource` records provenance ("eaip" authoritative wins
  // over "openaip" community) so a later OpenAIP run cannot clobber eAIP hours.
  hoursStructured: text("hours_structured"), // JSON: StructuredHours
  hoursSource: text("hours_source"), // "eaip" | "openaip"
  // AD 2.13 declared distances per runway (TORA/TODA/ASDA/LDA, metres) - JSON
  // `Record<designator, {tora?,toda?,asda?,lda?}>`, see src/lib/airport-facts.
  // Authoritative eAIP-only (no free dataset carries it); `declaredSource`
  // records provenance so a non-AIP source can never clobber it.
  declaredDistances: text("declared_distances"), // JSON: DeclaredDistances
  declaredSource: text("declared_source"), // "eaip"
  // DE-only: raw text OCR'd from the DFS BasicVFR AD-2 page images (they are
  // base64 PNGs, so OCR is the sole route to any DE AD-2 datum). DISPLAY-only
  // under a "read by text recognition, verify against the AIP" caveat - NEVER
  // parsed into hours / the open badge / the map filter / JSON-LD (owner safety
  // directive: a mis-OCR'd hours digit must not become a machine claim).
  ad2OcrText: text("ad2_ocr_text"), // English AD-2 pages
  ad2OcrTextDe: text("ad2_ocr_text_de"), // German AD-2 pages (translated narrative)
  ad2OcrSource: text("ad2_ocr_source"), // "dfs-ocr"
  ppr: integer("ppr", { mode: "boolean" }), // prior permission required (OpenAIP)
  aerodromeType: integer("aerodrome_type"), // OpenAIP airport `type` enum code
  restaurant: integer("restaurant", { mode: "boolean" }), // on-field restaurant
  customs: integer("customs", { mode: "boolean" }), // customs / airport of entry
  source: text("source").notNull(), // provenance, e.g. "ourairports"
  updatedAt: integer("updated_at"), // unix seconds
});

export interface RunwayFact {
  ident: string; // e.g. "06/24"
  lengthFt: number | null;
  widthFt: number | null;
  surface: string | null; // free text (e.g. "ASP", "Asphalt", "GRASS")
  // Circuit (traffic-pattern) direction. Safety-relevant, so only set from an
  // unambiguous source; null when unknown. OpenAIP-only, best-effort.
  trafficPattern?: "left" | "right" | null;
}

export interface FrequencyFact {
  type: string; // free text (e.g. "TWR", "INFO", "ATIS")
  description: string | null;
  mhz: string; // e.g. "120.075"
}

// AD 2.13 declared distances (metres) keyed by runway designator ("08",
// "03G"). Each value present only when the AIP states it (NIL -> omitted).
export interface DeclaredDistance {
  tora?: number;
  toda?: number;
  asda?: number;
  lda?: number;
}
export type DeclaredDistances = Record<string, DeclaredDistance>;

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
  // AIRAC/edition effective date of the crawled data (ISO "2026-07-09"),
  // derived from the source's edition-dated chart/page URLs at crawl time
  // (airacDateFromUrl). Nullable: sources whose URLs carry no date (e.g. CZ)
  // leave it null and the list page shows only the crawl "last updated" line.
  airac: text("airac"),
});
