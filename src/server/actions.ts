"use server";

import { z } from "zod";
import { QUERIES } from "~/server/db/queries";

const schema = z.object({
  search: z.string().min(1).max(50),
  country: z.string().length(2),
  // Include "mil" and "aeroport" so the live search works on the French
  // /military and /aeroports pages - those pass their page type through the
  // hidden form field, and the old ["vfr","ifr","heliport"] enum rejected them,
  // making French search always return zero results.
  type: z.enum(["vfr", "ifr", "heliport", "mil", "aeroport"]),
});

export async function searchAirports(_prevState: unknown, formData: FormData) {
  const validatedFields = schema.safeParse({
    search: formData.get("search"),
    country: formData.get("country"),
    type: formData.get("type"),
  });

  if (!validatedFields.success) {
    return {
      airports: [],
    };
  }

  const airports = await QUERIES.airports(
    validatedFields.data.search,
    validatedFields.data.country,
    validatedFields.data.type,
  );

  return {
    airports: airports,
  };
}
