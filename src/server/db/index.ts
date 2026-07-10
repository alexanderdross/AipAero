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
  // During `next build` (static generation) there is no Worker binding, and
  // calling getCloudflareContext({ async: true }) boots a miniflare `workerd`
  // instance PER call to synthesize one. Across the ~180 build-time reads that
  // is a swarm of dozens of workerd processes, which OOMs the memory-limited CI
  // runners (the E2E + Lighthouse jobs build with plain `next build`; exit 137).
  // Reads are meant to fail-soft to empty during the build and revalidate at
  // runtime (same NEXT_PHASE signal queries.ts uses), so short-circuit to null
  // BEFORE touching the Cloudflare context. Production runs on the real binding.
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env?.DB) return null;
    return drizzle(env.DB, { schema });
  } catch {
    // No Cloudflare context (e.g. during build) - signal "unavailable".
    return null;
  }
});
