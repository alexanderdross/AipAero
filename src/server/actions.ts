"use server";

import { z } from "zod";
import { QUERIES } from "~/server/db/queries";

const schema = z.object({
  search: z.string().min(1).max(50),
  country: z.string().max(2),
  type: z.enum(["vfr", "ifr", "heliport"]),
});

export async function searchAirports(prevState: any, formData: FormData) {
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
