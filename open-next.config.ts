import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

/**
 * OpenNext Cloudflare adapter configuration.
 *
 * - Incremental cache (ISR + `unstable_cache` data cache) → Cloudflare R2
 *   (`NEXT_INC_CACHE_R2_BUCKET`). R2 replaces the previous KV backend: KV's
 *   free-tier write cap is 1,000/day, which a single crawler-triggered
 *   `revalidateTag` (invalidates every airport entry) + bot re-crawl blows
 *   through. R2 allows ~1M Class-A writes/month. `withRegionalCache` adds a
 *   per-colo Cache-API layer to spare R2 reads/tag-lookups on cache hits.
 * - Tag cache (backs `revalidateTag`, called from POST /api/airports) → D1
 *   (`NEXT_TAG_CACHE_D1`).
 * - Queue (ISR revalidation, i.e. the `export const revalidate = 3600` safety
 *   net on airport-list + the sitemap) → memory queue. Without a queue the
 *   adapter installs a dummy that THROWS on every stale-page hit ("FatalError:
 *   Dummy queue is not implemented" in the production logs) and the pages can
 *   never self-refresh. The memory queue re-renders stale routes via the
 *   `WORKER_SELF_REFERENCE` service binding (see wrangler.jsonc) with
 *   per-isolate de-duping - plenty for our two low-traffic ISR routes; the
 *   Durable-Object queue would be overkill.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
  }),
  tagCache: d1NextTagCache,
  queue: memoryQueue,
});
