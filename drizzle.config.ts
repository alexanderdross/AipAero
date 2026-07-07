import { type Config } from "drizzle-kit";

/**
 * Drizzle Kit config for Cloudflare D1 (SQLite).
 *
 * - `drizzle-kit generate` produces SQL migrations under ./drizzle and needs no
 *   credentials. Apply them to D1 with `wrangler d1 migrations apply <db>`
 *   (add `--local` for the local preview database, `--remote` for production).
 * - `drizzle-kit studio`/`push` use the `d1-http` driver and read the Cloudflare
 *   credentials below from the environment when set.
 */
export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
  tablesFilter: ["aip_aero_v4_*"],
} satisfies Config;
