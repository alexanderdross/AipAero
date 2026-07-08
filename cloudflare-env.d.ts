// Types for the Cloudflare bindings exposed to the Worker at runtime via
// `getCloudflareContext()`. `wrangler types` can regenerate/extend this, but we
// declare the bindings the app relies on so `getCloudflareContext<CloudflareEnv>()`
// is typed without a generation step.
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    /** Application database. */
    DB: D1Database;
    /** OpenNext incremental (ISR/data) cache. */
    NEXT_INC_CACHE_R2_BUCKET: R2Bucket;
    /** OpenNext tag cache backing `revalidateTag`. */
    NEXT_TAG_CACHE_D1: D1Database;
    /** Static assets binding used by OpenNext. */
    ASSETS: Fetcher;
    CRON_SECRET: string;
    ADSENSE_ID: string;
    NODE_ENV: string;
  }
}

export {};
