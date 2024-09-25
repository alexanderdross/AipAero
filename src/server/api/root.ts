import { type inferRouterOutputs } from "@trpc/server";
import { airportRouter } from "~/server/api/routers/airports";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  airport: airportRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

type RouterOutput = inferRouterOutputs<AppRouter>;
export type AirportSearchOutput = RouterOutput["airport"]["search"];
export type AirportGetAllOfCountryOutput = RouterOutput["airport"]["getAllOfCountry"];

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
