import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   *
   * On Cloudflare Workers the database is reached through the `DB` D1 binding
   * (see `wrangler.jsonc` + `src/server/db/index.ts`), so there is no database
   * connection string to validate here. `CRON_SECRET` is a Worker secret and
   * `ADSENSE_ID` a plain var; OpenNext exposes both via `process.env` at runtime.
   */
  server: {
    CRON_SECRET: z.string().min(1),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ADSENSE_ID: z.string().min(1),
    // Optional: OpenAIP core API key (header `x-openaip-api-key`). When unset,
    // the embedded aerodrome-facts card falls back to the OurAirports data in
    // D1 (or renders nothing). Create one at https://www.openaip.net (profile ->
    // API Key) and set it with `wrangler secret put OPENAIP_API_KEY`.
    OPENAIP_API_KEY: z.string().optional(),
    // Optional: IndexNow key (public by design, served at `/<key>.txt`). When
    // set, a crawler publish pings Bing + partners for the country's landing +
    // list pages (src/lib/indexnow.ts). A plain `var` in wrangler.jsonc, NOT a
    // secret. Unset = the ping is a no-op. Must equal the public/<key>.txt name.
    INDEXNOW_KEY: z.string().optional(),
    // Optional: shared Bearer token for the public read-only data API
    // (`/api/v1/*`, src/lib/api-auth.ts). Issued to integration partners. When
    // unset the API returns 503 (inert / not provisioned), so a deploy without
    // it exposes nothing. Set with `wrangler secret put PUBLIC_API_KEY`.
    PUBLIC_API_KEY: z.string().optional(),
    // --- Contact form (/contact/, /de/kontakt/) -------------------------------
    // Cloudflare Turnstile keys. The SITE key is public (rendered in the widget)
    // - a plain `var` in wrangler.jsonc; the SECRET key gates the server-side
    // siteverify - a Worker secret. When either is unset in production the
    // contact API returns 503 (inert). In development both fall back to
    // Cloudflare's always-pass test keys, so the form works with no config.
    TURNSTILE_SITE_KEY: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    // Netcup SMTP relay used to deliver the submitted message. Sent over
    // Cloudflare's TCP socket API (worker-mailer); port 587 (STARTTLS) or 465
    // (implicit TLS) - port 25 is blocked on Workers. When SMTP is unconfigured
    // the contact API returns 503. `SMTP_FROM` is the envelope/From mailbox
    // (must be a real netcup mailbox on the sending domain, so SPF/DMARC pass);
    // it defaults to `SMTP_USER` when unset. The visitor's address goes into
    // Reply-To, never From.
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    ADSENSE_ID: process.env.ADSENSE_ID,
    OPENAIP_API_KEY: process.env.OPENAIP_API_KEY,
    INDEXNOW_KEY: process.env.INDEXNOW_KEY,
    PUBLIC_API_KEY: process.env.PUBLIC_API_KEY,
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   *
   * Build-time validation is also skipped in CI build containers (`CI` is set by GitHub
   * Actions AND by Cloudflare's Workers Builds image; `WORKERS_CI` is Workers Builds
   * specific). Build machines never have the Worker's runtime secrets (CRON_SECRET,
   * ADSENSE_ID) - those are validated at runtime on the Worker, where they exist. Without
   * this, the Workers Builds Git integration fails during `next build` page-data collection
   * regardless of which package.json script the dashboard invokes.
   */
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    !!process.env.CI ||
    !!process.env.WORKERS_CI,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
