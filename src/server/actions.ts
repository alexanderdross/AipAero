"use server";

import { z } from "zod";
import { QUERIES } from "~/server/db/queries";
import type { Airport } from "~/server/db/schema";

const schema = z.object({
  search: z.string().min(1).max(50),
  country: z.string().length(2),
  // Include "mil" and "aeroport" so the live search works on the French
  // /military and /aeroports pages - those pass their page type through the
  // hidden form field, and the old ["vfr","ifr","heliport"] enum rejected them,
  // making French search always return zero results.
  type: z.enum(["vfr", "ifr", "heliport", "mil", "aeroport"]),
});

// Every search action returns the validated `query` alongside the results, so
// the client can tell "an actual search completed and matched nothing" (show
// the no-results note) apart from "nothing searched yet" (show nothing) without
// a pre-submit flash. Empty `query` = validation failed / not searched.
export type SearchState = { airports: Airport[]; query: string };

export async function searchAirports(
  _prevState: unknown,
  formData: FormData,
): Promise<SearchState> {
  const validatedFields = schema.safeParse({
    search: formData.get("search"),
    country: formData.get("country"),
    type: formData.get("type"),
  });

  if (!validatedFields.success) {
    return { airports: [], query: "" };
  }

  const airports = await QUERIES.airports(
    validatedFields.data.search,
    validatedFields.data.country,
    validatedFields.data.type,
  );

  return { airports, query: validatedFields.data.search };
}

const globalSchema = z.object({
  search: z.string().min(1).max(50),
});

// Cross-country search: matches an airport by title or ICAO across ALL countries
// and types (the per-country `searchAirports` is scoped to one country + type).
// Backs the global search box on the root page.
export async function searchAirportsGlobal(
  _prevState: unknown,
  formData: FormData,
): Promise<SearchState> {
  const validated = globalSchema.safeParse({ search: formData.get("search") });
  if (!validated.success) {
    return { airports: [], query: "" };
  }
  const airports = await QUERIES.airportsGlobal(validated.data.search);
  return { airports, query: validated.data.search };
}

const countrySchema = z.object({
  search: z.string().min(1).max(50),
  country: z.string().length(2),
});

// Country-scoped search across ALL of that country's types (VFR/IFR/heliport/…)
// - backs the search box on the country landing page, so a visitor can find a
// field without first choosing a category. Results link to the airport detail
// page. Unlike `searchAirports` this takes no `type`, so it spans every type.
export async function searchAirportsCountry(
  _prevState: unknown,
  formData: FormData,
): Promise<SearchState> {
  const validated = countrySchema.safeParse({
    search: formData.get("search"),
    country: formData.get("country"),
  });
  if (!validated.success) {
    return { airports: [], query: "" };
  }
  const airports = await QUERIES.airportsCountry(
    validated.data.search,
    validated.data.country,
  );
  return { airports, query: validated.data.search };
}
