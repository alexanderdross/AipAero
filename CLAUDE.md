# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**AIP:Aero** — the Next.js frontend for [https://aip.aero](https://aip.aero), an aggregator of European AIP (Aeronautical Information Publication) AD (Aerodrome) data. Bootstrapped with [create-t3-app](https://create.t3.gg/).

## Hosting (split architecture)

The system runs on **two hosts** by design — do not try to consolidate them:

- **Website (`src/`) → [Vercel](https://vercel.com).** The new `aip.aero` is served from Vercel via the GitHub integration. Treat all Next.js code as serverless: no persistent filesystem at runtime, no long-running request handlers, no Chromium/Selenium. New env vars must be added to `.env.example`, validated in `src/env.js`, and set in the Vercel project settings.
- **Crawlers (`crawlers/`) → [netcup](https://www.netcup.eu/) root server.** The Python scrapers continue to run on the existing netcup VM under systemd (`aip-crawler.service` + `aip-crawler.timer`). They are **not** deployed to Vercel — serverless is the wrong model for scheduled, long-running, browser-driven scraping. They reach the website by HTTP, posting to `https://aip.aero/api/airports` with `CRON_SECRET`.
- **Legacy:** the website used to run on the same netcup host via Docker (`Dockerfile` + `docker-compose.yml`). Those files are kept for local container testing only; the netcup host no longer serves the website.
- `next.config.mjs` currently sets `output: "standalone"` (left over from the Docker image). Vercel ignores it — leave it in place unless explicitly asked to change.

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19, Turbopack dev)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS + Radix UI primitives + `tailwind-merge` / `class-variance-authority`
- **ORM / DB:** Drizzle ORM with MySQL (`mysql2`); table prefix `aip-aero_*`
- **i18n:** `next-intl` — message bundles live in `messages/` (`at`, `de`, `fr`, `nl`, `uk` plus `*-EN` variants)
- **Logging:** `next-axiom` (Axiom)
- **Env validation:** `@t3-oss/env-nextjs` + Zod in `src/env.js`
- **Package manager:** `pnpm@10.8.1` (declared in `package.json`)

## Repository Layout

```
src/
  app/              Next.js App Router (includes [locale] segment, /api, /2d6a9a sitemaps)
  components/       UI components and shadcn-style primitives in components/ui
  server/
    actions.ts      Server actions (read/insert airports, cache invalidation)
    db/             Drizzle schema and client (schema.ts)
  lib/              Utilities (try-catch, cn, etc.)
  i18n/             next-intl routing + request config
  middleware.ts     next-intl locale middleware
  styles/           Tailwind globals
  env.js            Validated environment variables
messages/           i18n message JSON files
crawlers/           Python (uv) Selenium scrapers that POST airports to /api/airports
public/             Static assets
```

## Common Commands

```bash
pnpm install
pnpm dev               # next dev --turbo
pnpm build             # next build
pnpm start             # next start
pnpm check             # next lint && tsc --noEmit
pnpm lint              # next lint
pnpm lint:fix
pnpm typecheck         # tsc --noEmit
pnpm format:write      # prettier
pnpm format:check
pnpm db:generate       # drizzle-kit generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
./start-database.sh    # local MySQL via Docker (reads .env)
```

Always run `pnpm check` before declaring a code change complete.

## Architecture Notes

```
Crawlers (Python) ── POST ──▶ /api/airports ──▶ insert server action ──▶ MySQL
                                                  └─▶ revalidate cache
Website ──▶ read server action ──▶ cache ──(miss)──▶ MySQL
```

- The `/api/airports` route is authenticated via `CRON_SECRET`; the same secret must be shared with the crawlers.
- Reads go through cached server actions; insertions invalidate the cache.
- `next.config.mjs` enables `experimental.useCache` and rewrites `/2d6a9a/sitemap.xml` → `/2d6a9a/index.xml`.
- `trailingSlash: true` is set — keep internal links consistent with that.

## Environment Variables

Defined in `src/env.js` and `.env.example`:

| Name | Side | Purpose |
| --- | --- | --- |
| `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME` | server | MySQL connection |
| `CRON_SECRET` | server | Auth for `/api/airports` (crawlers + cron) |
| `ADSENSE_ID` | server | Google AdSense publisher id |
| `NEXT_PUBLIC_AXIOM_DATASET` / `NEXT_PUBLIC_AXIOM_TOKEN` | client | next-axiom logging |
| `NODE_ENV` | server | standard |

When adding a new var: update `.env.example`, add it to both `server`/`client` and `runtimeEnv` in `src/env.js`, and remember to set it in Vercel.

## Conventions

- Prefer editing existing files over creating new ones; do not add new top-level docs unless asked.
- Keep components colocated under `src/components`; primitives go in `src/components/ui`.
- Server-only logic belongs under `src/server` (`"use server"` actions, DB access, secrets).
- Database table names are prefixed `aip-aero_` (see `drizzle.config.ts` `tablesFilter`).
- For new translated strings, update **all** locale files in `messages/` (including `*-EN` variants) so builds don't break.
- Use `pnpm` — never `npm` or `yarn` (lockfile is `pnpm-lock.yaml`).
- Don't introduce Node-specific runtime APIs in code that may run on Vercel's edge runtime (`middleware.ts`).

## Crawlers (subproject)

`crawlers/` is a separate Python project managed with [`uv`](https://github.com/astral-sh/uv). Each country crawler implements `crawl()` and returns a list of `Airport` records (`crawlers/crawlers/models.py`) which `OutputHandler` POSTs to `https://aip.aero/api/airports`. See `crawlers/README.md` for the per-country task list and the `Airport` schema.

Runtime: scheduled by systemd (`aip-crawler.service` + `aip-crawler.timer`) on the netcup root server. The crawlers are **never** deployed to Vercel; treat the website and the crawlers as two independent deploy targets that communicate only over HTTP.

Two base classes coexist during the in-flight Selenium → httpx migration:

- **`crawlers/crawlers/http_base.py` → `HttpCrawlerBase`** — preferred. Wraps an `httpx.Client` (pooled, redirects, sane UA), exposes `fetch()`, `soup()`, `get_frame_src()`, `follow_frame_chain()`, `clean_text()`, and `save_response()` for post-mortem debugging. No browser.
- **`crawlers/crawlers/http_eurocontrol_base.py` → `HttpEurocontrolBase`** — extends `HttpCrawlerBase` with `extract_airports_from_html()`, the BS4 parser for the eurocontrol-style eAIP navigation HTML (NL, UK, FR all share it).
- **`crawlers/crawlers/crawler_base.py` → `CrawlerBase`** *(legacy, Selenium)* — only DE still inherits from it. Re-exports `Airport` from `models.py` so old imports keep working.
- **`crawlers/crawlers/eurocontrol_base.py` → `EurocontrolBase`** *(legacy, Selenium)* — orphaned after the NL/UK/FR ports; kept until `crawler_base.py` is deleted.

Migration status:

| Country | Base class                        | Browser? |
| ------- | --------------------------------- | -------- |
| AT      | `HttpCrawlerBase`                 | no       |
| NL      | `HttpEurocontrolBase`             | no       |
| UK      | `HttpEurocontrolBase`             | no       |
| FR      | `HttpEurocontrolBase`             | no       |
| DE      | `CrawlerBase` *(Selenium, legacy)* | yes — port pending netcup verification of the others |

When adding a new country crawler, inherit from `HttpCrawlerBase` (or `HttpEurocontrolBase` if the source is a eurocontrol eAIP). **Do not** introduce Puppeteer (Node-only) or run a browser inside a Vercel function. If a future AIP genuinely requires JS rendering (e.g. potentially CZ / GR / HR from the open task list), add a single Playwright (Python) fallback path.

Once DE is ported, delete `crawler_base.py`, `eurocontrol_base.py`, and the `selenium` / `webdriver-manager` dependencies from `crawlers/pyproject.toml` in one commit.
