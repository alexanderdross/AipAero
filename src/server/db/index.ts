import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

import * as schema from "./schema";

export type DB = DrizzleD1Database<typeof schema>;

/**
 * Resolve the Drizzle client bound to the Cloudflare D1 database.
 *
 * The D1 binding only exists inside a request/worker context, so it cannot be
 * created at module load time (unlike the old mysql2 pool). We look it up lazily
 * via `getCloudflareContext`. During `next build` (static generation) there is no
 * binding available - we return `null` so callers can fall back to empty results
 * and let the page revalidate once the worker is running.
 *
 * `react.cache` dedupes the lookup within a single request.
 */
export const getDb = cache(async (): Promise<DB | null> => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env?.DB) return null;
    return drizzle(env.DB, { schema });
  } catch {
    // No Cloudflare context (e.g. during build) - signal "unavailable".
    return null;
  }
});
