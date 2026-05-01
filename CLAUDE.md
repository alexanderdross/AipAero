# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**AIP:Aero** — the Next.js frontend for [https://aip.aero](https://aip.aero), an aggregator of European AIP (Aeronautical Information Publication) AD (Aerodrome) data. Bootstrapped with [create-t3-app](https://create.t3.gg/).

## Hosting

- **Production target:** [Vercel](https://vercel.com). The new version of `aip.aero` is hosted on Vercel; deployments are triggered through the Vercel GitHub integration.
- **Legacy:** the previous version ran on a [netcup](https://www.netcup.eu/) root server using Docker (`Dockerfile` + `docker-compose.yml`). These files are kept for local container testing and as a fallback, but **do not assume Docker/netcup is the deployment path** when proposing changes.
- When adding features (env vars, file system writes, long-running tasks, large bundles, custom servers), keep Vercel's serverless model in mind:
  - No persistent local filesystem at runtime — use the database or external storage.
  - Long-running work belongs in cron jobs / external workers, not request handlers.
  - New env vars must be added to `.env.example`, validated in `src/env.js`, and set in the Vercel project settings.
  - `next.config.mjs` currently sets `output: "standalone"` (for the Docker image). Vercel ignores it, so leave it in place unless explicitly asked to change.

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

`crawlers/` is a separate Python project managed with [`uv`](https://github.com/astral-sh/uv). Each country crawler inherits `CrawlerBase` and writes `Airport` records back to the Next.js API. See `crawlers/README.md` for the per-country task list and the expected `Airport` schema. The crawlers run on a systemd timer (`aip-crawler.timer`) on a separate host — they are **not** deployed to Vercel.
