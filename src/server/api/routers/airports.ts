import { and, asc, eq, like, or } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { airports } from "~/server/db/schema";

export const airportRouter = createTRPCRouter({
  search: publicProcedure
    .input(z.object({ 
      type: z.enum(["vfr", "ifr", "heliport"]),
      country: z.string().length(2),
      query: z.string()
    }))
    .query(async ({ ctx, input }) => {
      if (input.query.length === 0) {
        return [];
      }
      const posts = await ctx.db.query.airports.findMany({
        columns: {
          title: true,
          icao: true,
          url: true
        },
        limit: 5,
        where: and(
          eq(airports.country, input.country),
          eq(airports.type, input.type),
          or(
            like(airports.title, `%${input.query}%`),
            like(airports.icao, `%${input.query}%`)
          )
        ),
        orderBy: [asc(airports.title)],
      });
      return posts;
    }),

  getAllOfCountry: publicProcedure
    .input(z.object({ country: z.string().length(2) }))
    .query(async ({ ctx, input }) => {
      const posts = await ctx.db.query.airports.findMany({
        columns: {
          title: true,
          icao: true,
          url: true,
          type: true
        },
        where: eq(airports.country, input.country),
        orderBy: [asc(airports.title)],
      });
      return posts;
    }),
});
