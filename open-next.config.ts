import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

/**
 * OpenNext Cloudflare adapter configuration.
 *
 * - Incremental cache (ISR + `unstable_cache` data cache) → Workers KV
 *   (`NEXT_INC_CACHE_KV`).
 * - Tag cache (backs `revalidateTag`, called from POST /api/airports) → D1
 *   (`NEXT_TAG_CACHE_D1`).
 */
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: d1NextTagCache,
});
