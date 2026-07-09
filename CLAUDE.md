# CLAUDE.md - AIP:Aero Project Knowledge Base

## Project Overview

**AIP:Aero** (https://aip.aero) is a website that simplifies the search for Aeronautical Information Publications (AIPs), approach charts, and airport data for VFR, IFR, heliports, military aerodromes, and French aeroports across multiple European countries.

- **Author**: Alexander Dross
- **Stack**: T3 Stack (Next.js + Drizzle ORM + Tailwind CSS), bootstrapped with `create-t3-app` v7.38.1
- **Package Manager**: pnpm (v10.8.1)
- **Node**: 22 (CI + build); the legacy `Dockerfile` still uses `node:21-alpine`

## Hosting (split architecture)

The system runs on **two hosts** by design - do not try to consolidate them:

- **Website (`src/`) → [Cloudflare Workers](https://workers.cloudflare.com/)** via the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`). Config lives in `wrangler.jsonc` + `open-next.config.ts`. Build/deploy with `pnpm cf-build` / `pnpm deploy`; local preview with `pnpm preview`. Treat all Next.js code as serverless on the Workers runtime: no persistent filesystem, no long-running handlers, no Chromium/Selenium, no raw Node TCP. New env vars must be added to `.env.example`, validated in `src/env.js`, mirrored in `.dev.vars` for local preview, and set on the Worker (`wrangler secret put` for secrets, `vars` in `wrangler.jsonc` for plain vars).
- **Database → [Cloudflare D1](https://developers.cloudflare.com/d1/)** (SQLite), reached via the `DB` binding (see `src/server/db/index.ts`). There is no connection string - access is through `getCloudflareContext().env.DB`. Two more Cloudflare resources back OpenNext caching: an R2 bucket (`NEXT_INC_CACHE_R2_BUCKET` → bucket `aip-aero-inc-cache`, incremental/data cache) and a D1 database (`NEXT_TAG_CACHE_D1`, backs `revalidateTag`). R2 replaced the former `NEXT_INC_CACHE_KV` namespace, whose free-tier 1k-writes/day cap was exhausted by wholesale cache invalidation on every crawl.
- **Crawlers (`crawlers/`) → [netcup](https://www.netcup.eu/) root server.** The Python scrapers continue to run on the existing netcup VM under systemd (`aip-crawler.service` + `aip-crawler.timer`). They are **not** deployed to Workers - serverless is the wrong model for scheduled, long-running scraping. They reach the website by HTTP, posting to `https://aip.aero/api/airports` with `CRON_SECRET`. This contract is unchanged by the Cloudflare migration.
- **Legacy:** the website previously ran on netcup via Docker (`Dockerfile` + `docker-compose.yml`) and on [Vercel](https://vercel.com) via the GitHub integration. Both are retired for serving the website; the Docker files are kept for local container testing only. `output: "standalone"` was removed from `next.config.mjs` (the OpenNext adapter produces the Worker bundle instead).

## Git Workflow

- **Development branch**: `dev` - all work goes here
- **Production branch**: `main` - never push directly to main
- Always branch from and merge into `dev`

## Quick Commands

```bash
pnpm dev          # Start dev server with Turbopack
pnpm build        # Production build
pnpm start        # Start production server
pnpm check        # Run lint + typecheck
pnpm lint         # ESLint only
pnpm lint:fix     # ESLint with auto-fix
pnpm typecheck    # TypeScript type checking (tsc --noEmit)
pnpm format:write # Prettier format
pnpm format:check # Prettier check

# Database (Cloudflare D1 / SQLite; drizzle.config.ts uses the d1-http driver)
pnpm db:generate  # Generate Drizzle (SQLite) migrations into drizzle/
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema to the remote D1 (needs CLOUDFLARE_* tokens)
pnpm db:studio    # Open Drizzle Studio (against remote D1)
wrangler d1 migrations apply DB --local   # apply schema to the local preview D1
# ./start-database.sh  # legacy: local MySQL via Docker - pre-D1, only for the retired Docker path
```

Always run `pnpm check` before declaring a code change complete.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request to `main` and on every push to `main`. Four parallel jobs:

| Job | Steps |
| --- | --- |
| **Website (Next.js)** | `pnpm install --frozen-lockfile` → `typecheck` → `format:check` → `lint` → i18n parity → `test` (vitest) → `audit` (high+) → `cf-build` (OpenNext Worker build) |
| **Crawlers (Python)** | `uv lock --check` → `uv sync --frozen` → `python -m compileall` → import smoke test for all 12 country crawlers → `pytest` |
| **E2E & rendered output (Playwright)** | `pnpm build` → `pnpm test:e2e` (Playwright, Chromium) against a `next start` server: rendered-output **SEO** contract (meta description in `<head>` & unique, canonical/OG/Twitter, `<main>`, `<html lang>`), **axe** accessibility, **JSON-LD** structured-data validity, user **flows** (search, locale switch, 404), and **sitemap** structure. |
| **Lighthouse budgets (local)** | `pnpm build` → start `pnpm start` → `treosh/lighthouse-ci-action` against localhost URLs with budgets from `.lighthouserc.cjs` (SEO + a11y gate, best-practices + performance warn). |

Notes:

- **The OpenNext build is now gated in CI** (`pnpm cf-build`). It no longer needs a database: DB reads go through the `DB` D1 binding, which at build time is a local empty D1, so reads fail-soft to empty results and revalidate at runtime. Vercel no longer builds PRs.
- **E2E tests run against `next start`** (production Node build), which is the only local server that reproduces production streaming-metadata `<head>` placement - the exact behaviour the `htmlLimitedBots` fix guards. The tests are black-box (`e2e/`), the page matrix in `e2e/pages.ts` mirrors `src/i18n/routing.ts`, and the DB is absent (reads fail-soft) so airport-row-dependent happy paths (`?ICAO` detail, sitemap airport entries) are left to the deployed Lighthouse run. Locally, point Playwright at a pre-installed Chromium with `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm test:e2e`.
- **`lighthouse.yml`** stays a manual `workflow_dispatch` run against any deployed URL (`base_url` input) - e.g. a `workers.dev` preview or `aip.aero`; it shares the `.lighthouserc.cjs` budgets. PR-time Lighthouse gating is the `lighthouse` job in `ci.yml` against a local server.
- **DE crawler is part of the import smoke test.** The legacy `crawler_base.py` / `eurocontrol_base.py` files remain in the tree only for the experimental belgium / car_sam_nam / pac_n / pac_p / run crawlers (none currently in production); they can be removed once those are either ported or pruned.

To gate merges on these checks, enable branch protection on `main` in repo settings → *Branches* → *Branch protection rules* (or *Rules → Rulesets*), and mark `Website (Next.js)`, `Crawlers (Python)`, `E2E & rendered output (Playwright)` and `Lighthouse budgets (local)` as required status checks.

## Architecture

```
Crawlers (Python, netcup) ── POST + CRON_SECRET ──▶ /api/airports (CF Worker)
                                                       │
                                                       ├─▶ insert mutation ──▶ D1 (batch)
                                                       └─▶ revalidateTag (KV/D1 caches)
Website (CF Worker) ──▶ QUERIES (unstable_cache) ──▶ cache ──(miss)──▶ D1
```

### Data Flow
1. **Python crawlers** scrape AIP websites for airport data. All twelve active country crawlers run on `httpx` + BeautifulSoup. The crawler subsystem also retries transient HTTP failures with exponential backoff, and `OutputHandler` refuses to publish if the new airport count drops > 50% from the last successful run (override with `CRAWLER_FORCE_PUBLISH=1`).
2. Crawlers POST airport data to `/api/airports` (authenticated via `CRON_SECRET` Bearer token).
3. The API validates with Zod, enriches with slugs, then atomically deletes existing country data and inserts new data via a D1 `batch` (D1 has no interactive transactions).
4. Cache is invalidated via `revalidateTag()` on insert.
5. Website pages query the DB through `unstable_cache`-wrapped functions in `queries.ts` (24h revalidate + per-country `country:<CC>` tags). The search query (`QUERIES.airports`) is deliberately **not** cached (one call per keystroke = unbounded cache entries). The Next `"use cache"` directive is **not** used - the OpenNext Cloudflare adapter does not support it yet.

## Directory Structure

```
/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (metadata, OG tags, AdSense)
│   │   ├── page.tsx                # Root page (/) - country selector landing
│   │   ├── not-found.tsx           # Global 404
│   │   ├── api/airports/route.ts   # POST endpoint for crawler data ingestion
│   │   ├── 2d6a9a/                 # Sitemap (obfuscated path)
│   │   │   ├── sitemap.ts          # Dynamic sitemap per country
│   │   │   └── index.xml/route.ts  # Sitemap index XML
│   │   └── [locale]/
│   │       ├── layout.tsx          # Locale layout (Header, Footer, i18n)
│   │       ├── page.tsx            # Country landing page (card grid)
│   │       ├── airport-list/       # Full airport list page
│   │       └── (search)/           # Route group for search pages
│   │           ├── vfr/page.tsx    # VFR airport search
│   │           ├── ifr/page.tsx    # IFR airport search (Germany only)
│   │           ├── heliports/      # Heliport search (not France)
│   │           ├── military/       # Military aerodromes (France only)
│   │           ├── aeroports/      # Aeroports (France only)
│   │           └── loading.tsx     # Shared loading state
│   ├── components/
│   │   ├── header.tsx              # Sticky header with logo, menu, lang switcher
│   │   ├── footer.tsx              # Footer with external links
│   │   ├── menu.tsx                # Desktop navigation (client component)
│   │   ├── mobile-menu.tsx         # Mobile navigation drawer
│   │   ├── box.tsx                 # Card component for country/type selection
│   │   ├── about-box.tsx           # About section container
│   │   ├── about-country-box.tsx   # Country-specific about section
│   │   ├── search-input-field.tsx  # Search input (client component, debounced)
│   │   ├── title.tsx               # Page title/description component
│   │   ├── breadcrumbs.tsx         # Breadcrumb navigation
│   │   ├── external-link.tsx       # External link with noopener/noreferrer
│   │   ├── locale-switcher.tsx     # Language toggle
│   │   ├── locale-switcher-select.tsx
│   │   ├── loading-sub.tsx         # Loading skeleton
│   │   ├── schemas/                # JSON-LD structured data
│   │   │   ├── schema-airport.tsx  # Airport schema
│   │   │   ├── schema-product.tsx  # Product schema
│   │   │   ├── schema-sitenav.tsx  # SiteNavigationElement schema
│   │   │   ├── schema-webpage.tsx  # WebPage schema
│   │   │   └── schema-website.tsx  # WebSite schema
│   │   └── ui/                     # shadcn/ui components (new-york style)
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── drawer.tsx
│   │       ├── input.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── select.tsx
│   │       └── skeleton.tsx
│   ├── i18n/
│   │   ├── routing.ts             # Locale config, pathnames, mappings
│   │   └── request.ts             # next-intl request config
│   ├── lib/
│   │   ├── utils.ts               # cn(), orgUrl, constants, i18nPathMapping
│   │   └── try-catch.ts           # Async try-catch wrapper utility
│   ├── server/
│   │   ├── actions.ts             # Server action: searchAirports
│   │   └── db/
│   │       ├── index.ts           # Drizzle (drizzle-orm/d1) via the DB binding
│   │       ├── schema.ts          # DB schema (airports table)
│   │       └── queries.ts         # QUERIES and MUTATIONS with caching
│   ├── middleware.ts              # next-intl middleware with link header customization
│   ├── env.js                     # t3-env validation
│   └── styles/globals.css         # Tailwind + CSS variables
├── messages/                       # i18n translation files
│   ├── uk.json                    # English (UK)
│   ├── de.json / de-EN.json       # German / English for Germany
│   ├── fr.json / fr-EN.json       # French / English for France
│   ├── nl.json / nl-EN.json       # Dutch / English for Netherlands
│   └── at.json / at-EN.json       # German / English for Austria
├── crawlers/                       # Python crawler subsystem
│   ├── main.py                    # Entry point
│   ├── settings.py                # Pydantic settings (env-based)
│   ├── output_handler.py          # POST results to API
│   ├── crawlers/
│   │   ├── models.py              # Airport pydantic model (shared)
│   │   ├── http_base.py           # HttpCrawlerBase (httpx-based, preferred)
│   │   ├── http_eurocontrol_base.py # HttpEurocontrolBase (BS4 eAIP parser)
│   │   ├── playwright_base.py     # PlaywrightCrawlerBase (headless-Chromium render, JS sources - DK)
│   │   ├── crawler_base.py        # CrawlerBase (Selenium, legacy - experimental crawlers only)
│   │   ├── eurocontrol_base.py    # EurocontrolBase (Selenium, legacy - orphaned)
│   │   ├── at.py                  # Austria - HttpCrawlerBase
│   │   ├── nl.py                  # Netherlands - HttpEurocontrolBase
│   │   ├── uk.py                  # United Kingdom - HttpEurocontrolBase
│   │   ├── fr.py                  # France - HttpEurocontrolBase
│   │   ├── de.py                  # Germany - HttpCrawlerBase (DFS BasicVFR/BasicIFR, static permalinks)
│   │   └── ...                    # Other country crawlers
│   ├── pyproject.toml             # Python dependencies (uv)
│   └── tasks/                     # Planned crawler task specs
├── public/                        # Static assets
│   ├── logo.webp                  # Site logo
│   ├── robots.txt
│   ├── ads.txt
│   └── aip-logo-*.jpg             # OG images
├── .github/workflows/ci.yml       # CI: typecheck + format:check + crawler smoke test
└── Configuration files
    ├── wrangler.jsonc             # Cloudflare Worker + D1/KV bindings (IDs are placeholders)
    ├── open-next.config.ts        # OpenNext adapter: KV incremental cache + D1 tag cache
    ├── cloudflare-env.d.ts        # Types for the Worker bindings (getCloudflareContext)
    ├── drizzle/                   # Generated D1 (SQLite) migrations
    ├── next.config.mjs            # trailingSlash, images.unoptimized, OpenNext dev init
    ├── tailwind.config.ts         # Custom colors (drossblue, drossgray)
    ├── tsconfig.json              # Strict mode, path alias ~/
    ├── drizzle.config.ts          # SQLite dialect (d1-http driver), aip_aero_v4_* table filter
    ├── components.json            # shadcn/ui config (new-york, lucide)
    ├── eslint.config.mjs          # Flat-config TypeScript ESLint + Drizzle rules (`pnpm lint`, gated in CI)
    ├── prettier.config.js         # Prettier + Tailwind plugin
    ├── Dockerfile                 # Multi-stage build (deps, build, runner) - legacy
    └── docker-compose.yml         # Single service, port 8080:3000 - legacy
```

## Database

- **Engine**: Cloudflare D1 (SQLite) via the `drizzle-orm/d1` driver and the `DB` Worker binding (`src/server/db/index.ts` → `getDb()`). No pool, no connection string; the client is created per request from `getCloudflareContext().env.DB`.
- **ORM**: Drizzle ORM (`drizzle-orm/sqlite-core` schema)
- **Table prefix**: `aip_aero_v4_`
- **Main table**: `aip_aero_v4_airports`
  - `id` (integer, PK, autoincrement)
  - `icao` (text, nullable) - ICAO airport code
  - `title` (text, not null) - Airport name
  - `url` (text, not null) - Link to AIP/approach chart
  - `type` (text with enum: 'vfr' | 'ifr' | 'heliport' | 'mil' | 'aeroport')
  - `country` (text, not null) - Country code (UK, DE, FR, NL, AT)
  - `slug` (text, not null) - URL-friendly identifier (ICAO or slugified title)
- **Indexes**: icao, title, type, country, slug
- **Migrations**: generated by `pnpm db:generate` into `drizzle/`, applied to D1 with `wrangler d1 migrations apply DB` (`--local` for the preview DB, `--remote` for production). The old Docker `db:push`-against-MySQL step is gone.

## Internationalization (i18n)

- **Library**: next-intl v3
- **Locales**: `at`, `at-EN`, `de`, `de-EN`, `fr`, `fr-EN`, `nl`, `nl-EN`, `uk`
- **Default locale**: `uk` (United Kingdom / English)
- **Locale prefix mode**: `always` (every URL has a locale prefix)
- **Custom prefixes**: `at-EN` -> `/at/en`, `de-EN` -> `/de/en`, etc.
- **Locale detection**: enabled, cookies disabled
- **Translation files**: `messages/<locale>.json`

### Locale Mappings
| Locale | Language | Country |
|--------|----------|---------|
| uk     | en       | uk      |
| de     | de       | de      |
| de-EN  | en       | de      |
| fr     | fr       | fr      |
| fr-EN  | en       | fr      |
| nl     | nl       | nl      |
| nl-EN  | en       | nl      |
| at     | de       | at      |
| at-EN  | en       | at      |

### Country-Specific Page Availability
| Page       | UK | DE | FR | NL | AT |
|------------|----|----|----|----|-----|
| /vfr       | Y  | Y  | N  | Y  | Y   |
| /ifr       | N  | Y  | N  | N  | N   |
| /heliports | Y  | Y  | N  | Y  | Y   |
| /military  | N  | N  | Y  | N  | N   |
| /aeroports | N  | N  | Y  | N  | N   |
| /airport-list | Y | Y | Y | Y  | Y   |

### Localized Pathnames
- `/airport-list` has country-specific slugs:
  - `at`: `/flughafen-liste-oesterreich`
  - `de`: `/flughafen-liste-deutschland`
  - `fr`: `/liste-des-aeroports-francais`
  - `nl`: `/luchthavenlijst-nederland`
  - `uk`: `/airport-list-uk`

## Supported Countries

| Country        | Code | Crawler Class | Base                  | Browser?        | AIP Source            |
|----------------|------|---------------|-----------------------|-----------------|-----------------------|
| Austria           | AT   | `AT`          | `HttpCrawlerBase`     | no              | Austro Control eAIP   |
| Germany           | DE   | `DE`          | `HttpCrawlerBase`     | no              | DFS BasicVFR/BasicIFR |
| France            | FR   | `FR`          | `HttpEurocontrolBase` | no              | SIA eAIP              |
| Netherlands       | NL   | `NL`          | `HttpEurocontrolBase` | no              | LVNL eAIP             |
| United Kingdom    | UK   | `UK`          | `HttpEurocontrolBase` | no              | NATS eAIP             |
| Belgium/Luxembourg| BE   | `BE`          | `HttpEurocontrolBase` | no              | skeyes eAIP           |
| Czechia           | CZ   | `CZ`          | `HttpEurocontrolBase` | no              | ANS CR (rlp.cz) eAIP  |
| Denmark           | DK   | `DK`          | `PlaywrightCrawlerBase` | yes (headless)  | Naviair (JS app)      |
| Greece            | GR   | `GR`          | `HttpEurocontrolBase` | via Web Unlocker | HANSP (aisgr) eAIP    |
| Norway            | NO   | `NO`          | `HttpEurocontrolBase` | no              | Avinor eAIP           |
| Poland            | PL   | `PL`          | `HttpEurocontrolBase` | no              | PANSA eAIP            |
| Sweden            | SE   | `SE`          | `HttpEurocontrolBase` | no              | LFV eAIP              |

All twelve active country crawlers are off Selenium. The legacy `crawler_base.py` and `eurocontrol_base.py` modules remain only for the experimental `belgium.py` / `car_sam_nam.py` / `pac_n.py` / `pac_p.py` / `run.py` files (none scheduled in `main.py`'s active list). Once those experimental crawlers are either ported to `HttpCrawlerBase` or removed, the legacy bases plus `selenium` / `webdriver-manager` can come out in one cleanup commit.

**Per-country page/type availability is data-driven** from `countryTypeAvailability` in `src/lib/utils.ts` (the single source of truth): the country landing cards (`[locale]/page.tsx` via `t.has`), the search-page `generateStaticParams`, the sitemap, the menus and the SiteNavigation schema all derive from it. Adding a country = one row there + its two translation files (native + `-EN`; a single English locale like `uk`/`be` has no `-EN` partner) + a crawler + a `routing.ts` locale/prefix/slug entry. The BE/CZ/DK/GR crawlers follow their `crawlers/tasks/*` specs; **NO/PL/SE have no task spec - their endpoints and eAIP section ids are best-effort and must be validated against the live source before the netcup cron relies on them.**

## API Endpoint

### POST `/api/airports`
- **Auth**: Bearer token (`CRON_SECRET` env var)
- **Body**: Array of airport objects (validated via Zod/drizzle-zod)
  ```json
  [{ "icao": "EDNY", "title": "Friedrichshafen", "url": "...", "type": "vfr", "country": "DE" }]
  ```
- **Behavior**: Deletes all existing airports for the country, then bulk inserts new data
- **Cache**: Invalidates all cache tags after insert

## Server Actions

### `searchAirports` (src/server/actions.ts)
- Used by `SearchInputField` client component
- Validates: search (1-50 chars), country (2 chars), type (vfr/ifr/heliport)
- Returns up to 5 matching airports via `QUERIES.airports()`

## Caching Strategy

- Reads are wrapped in Next's `unstable_cache` (in `src/server/db/queries.ts`). The newer `"use cache"` directive is **not** used - the OpenNext Cloudflare adapter doesn't support it yet.
- Cache lifetime: `revalidate: 86400` (24h). Freshness on real changes comes from on-demand `revalidateTag`, not the timer - so the timer is only a safety net and stays long to avoid needless rewrites.
- Each read carries a per-country tag `country:<CC>` (plus a type tag like `vfrAirports`). The as-you-type search (`QUERIES.airports`) is uncached.
- Invalidated on data insert via a single `revalidateTag(\`country:<CC>\`)` - a crawler POST (always one country) busts only that country's entries, not all ~1k across every country.
- On Workers this is backed by OpenNext's incremental cache (R2, `NEXT_INC_CACHE_R2_BUCKET`) and tag cache (D1, `NEXT_TAG_CACHE_D1`), configured in `open-next.config.ts`.
- During `next build` the OpenNext adapter exposes a local (empty) D1 binding; DB reads that fail at build return empty and revalidate at runtime (`IS_BUILD` guard in `queries.ts`), so the build needs no database.
- **Deploys seed EMPTY prerenders** (the build has no DB), which would serve empty airport lists/sitemaps until the next crawler POST. Three-layer self-heal: (1) build-written data-cache entries carry a 1h TTL (`BUILD_SEED_REVALIDATE_SECONDS` in `queries.ts` - not lower: a page's ISR interval is the MINIMUM of route revalidate and every cache TTL used at build, so a tiny TTL would make all prerendered pages rewrite that often); (2) `POST /api/revalidate` (Bearer `CRON_SECRET`) busts all `country:<CC>` tags and is called by the CD workflow after every deploy (needs the `CRON_SECRET` **repo secret**; fail-soft warning without it); (3) `export const revalidate = 3600` on `airport-list/page.tsx` and `2d6a9a/sitemap.ts` bounds staleness to 1h even if (2) and the crawlers are unavailable. Do NOT bypass `unstable_cache` during the build - the prerendered pages would lose their country tags and the on-demand `revalidateTag` flow would break.

## SEO

- Extensive JSON-LD structured data: BreadcrumbList, Product, Airport, WebSite, SiteNavigationElement, WebPage
- Dynamic sitemaps per country at `/2d6a9a/sitemap/<country>.xml`
- Sitemap index at `/2d6a9a/sitemap.xml` (rewritten from `/2d6a9a/index.xml`)
- Canonical URLs, alternate language links, OpenGraph, Twitter cards
- `trailingSlash: true` in Next.js config
- Static generation with `dynamicParams = false` and `generateStaticParams()`
- Airport detail pages use search params: `/vfr?EDNY` (slug as query key, no value)

### Airport detail URLs (`?ICAO`) are an intentional SEO strategy - do NOT convert to path segments

Airport detail pages are addressed by a **query-param key** - `/de/vfr/?EDMJ`, `/de/ifr/?EDDF`, etc. (the airport `slug`, usually the ICAO code, as a valueless query key). **This is deliberate and must stay.** These per-airport pages are the highest-value SEO pages on the site, and the `?ICAO` scheme is the chosen strategy. Do not "fix" them into path segments (`/de/vfr/EDMJ/`) - that would break the strategy and every already-indexed URL.

Consequences to preserve:

- **They must remain in the multilingual XML sitemap.** `src/app/2d6a9a/sitemap.ts` already enumerates every airport (via the `/airport-list` branch) and emits `${localizedPath}?${slug}` with `alternates.languages` for each country's native + English locale. Keep airport entries in the sitemap whenever the airport list or sitemap logic changes.
- Because they read `searchParams`, the search routes (`/vfr`, `/ifr`, `/heliports`, `/military`, `/aeroports`) are **dynamic** (not prerendered). Their `generateMetadata` sets per-airport `title` / `description` (and `SchemaAirport` JSON-LD) when a `?slug` is present, and the base-page metadata otherwise. Keep that server-side so crawlers get unique metadata per airport.

### Metadata / prerender gotcha: `setRequestLocale()` MUST precede `getMessages()`/`getTranslations()`

In `src/app/[locale]/layout.tsx` (and every statically-rendered locale page), call `setRequestLocale(locale)` **before** any `getMessages()` / `getTranslations()` call. If a translation is read first, next-intl falls back to `headers()`, which opts the whole route into **dynamic rendering**. On Cloudflare Workers (OpenNext), metadata reliably lands in the served `<head>` only for **prerendered/cached** HTML - so a wrongly-dynamic locale page renders without its meta description / Open Graph tags, which is exactly what Lighthouse's "Document does not have a meta description" flags. Country landing + `airport-list` pages are meant to be static; keep the `setRequestLocale` ordering correct so they stay prerendered.

### Metadata gotcha #2: streaming metadata puts `<meta>` in `<body>` on dynamic pages - `htmlLimitedBots` forces it into `<head>`

Since Next.js 15.2, metadata is **streamed** by default: on **dynamically rendered** routes it is emitted at the end of the stream (inside `<body>`) and only hoisted into `<head>` by client-side React - *unless* the request's user agent matches Next's built-in `htmlLimitedBots` list (Googlebot is deliberately **not** on it, since Google renders JS). The search / airport-detail routes (`/vfr`, `/ifr`, `/heliports`, `/military`, `/aeroports`) read `searchParams` for the `?ICAO` scheme, so they are dynamic - meaning their `<meta name="description">`, OG and Twitter tags stream into `<body>`, and Lighthouse / crawlers that read the raw `<head>` see no description. `next.config.mjs` sets **`htmlLimitedBots: /.*/`** (match every UA) to disable streaming metadata and emit it blocking in `<head>` for all requests. Verified with `pnpm start` by diffing the byte offset of `<meta name="description">` against `</head>` across Googlebot / plain-Chrome / Chrome-Lighthouse user agents. Trade-off: a small TTFB increase on dynamic pages (metadata resolves before the first byte) - acceptable for these SEO pages, and static pages are unaffected.

## Website gadgets & cross-links

Beyond the core search-and-link flow, the airport detail pages and the charts index carry a few add-ons. **Info gadgets are server-rendered (SSR) by design**; the only exceptions are plain outbound links (airport website, Google Maps), which need no server data. On the detail pages the gadgets are grouped into **three boxes** (contact/location, weather, aerodrome data) - see the wrapper below.

- **Weather (METAR/TAF)** - `src/components/airport-weather.tsx` + `src/lib/weather.ts`. Decoded METAR/TAF fetched **server-side** from the NOAA / Aviation Weather Center API (`aviationweather.gov`, free, no key), cached ~10 min via the OpenNext incremental cache, 5s timeout, fully **fail-soft** (no reporting station -> renders nothing, the common case for small VFR fields). Shows raw METAR/TAF, a decoded summary (wind/visibility/clouds/temp/QNH), the VFR/MVFR/IFR/LIFR flight-category badge and the observation time. Each raw report also carries a collapsible **decode tab** (`<details>`, no client JS) that expands it into plain-language lines via `src/lib/metar-decode.ts` (`decodeReport(raw, lang)`) - a pure, dependency-free token decoder with a built-in meteorological glossary (full en/de/fr/nl, English fallback for the other locales). The glossary lives in code, not the i18n JSON (fixed standard vocabulary, not site copy); only the toggle label is an i18n key (`Weather.decode`).
- **Airport gadgets wrapper** - `src/components/airport-gadgets.tsx`, rendered on all five detail pages (`vfr`/`ifr`/`heliports`/`military`/`aeroports`) below the chart link. Fetches weather + facts **once** and passes them into three boxes: **contact/location** (`airport-contact.tsx` - town + website from OurAirports, plus the **Google Maps** link, which resolves the field by coordinates when known else by ICAO/name query), **weather** (`airport-weather.tsx`), and **aerodrome data** (`airport-facts.tsx` - elevation, runways, frequencies, opening hours, and today's sunrise/sunset/civil twilight computed locally from the facts coordinates, with the METAR station as a fallback source for elevation/coords). `mt-24` clears the absolutely-positioned chart link.
- **Last updated** - `src/components/last-updated.tsx`, a localized date on the charts index (`airport-list`). Prefers the **real per-country crawl timestamp** (the `aip_aero_v4_crawl_meta` table, stamped in the same atomic batch as each crawler POST by `MUTATIONS.insertAirports`, read via `QUERIES.crawlUpdatedAt` with the country tag), falling back to the build stamp (`~/lib/build-info`) for countries not yet crawled since the last deploy.
- **Trade:Aero cross-link** - `src/lib/trade-aero.ts` + `src/components/trade-aero-cta.tsx`. Locale + country aware deep links to the sister marketplace (`https://trade.aero`), derived entirely from the locale config so new countries roll out automatically; localized CTA on the country landing + airport-list pages, plus a locale-aware footer link. Followed (`rel="noopener"`) with UTM attribution. See `docs/trade-aero-crosslink-concept.md`.
- **Aerodrome facts** - `src/components/airport-facts.tsx` + `src/lib/airport-facts.ts`. Embedded runways / frequencies / elevation / town / website / opening hours per ICAO, **merged** from three sources with a per-field precedence (see the `getAirportFacts` doc comment): **(1) OpenAIP** at request time when the `OPENAIP_API_KEY` secret is set (`src/lib/openaip.ts` fetch client + `src/lib/openaip-parse.ts` pure mapper, unit-tested; cached, fail-soft; richest, and the only source of fuel / PPR / opening hours / circuit direction - field names + enums verified against the authoritative public v1 schema at `api.core.openaip.net/api/schemas/response/airport/airport-schema.json`); **(2) OurAirports** base (public domain / CC0, imported into the D1 `airport_facts` table by `crawlers/import_ourairports.py` -> `POST /api/airport-facts`; the only source of `municipality` + `home_link`); **(3) AWC / NOAA** (`src/lib/awc-airport.ts`, the free no-key `aviationweather.gov` "airport" endpoint we already use for weather - an **always-on fallback** for coordinates / elevation / runways / frequencies, so the card works with no importer run and no key). **The persisted D1 row is primary** - the importer backfills the full enrichment (OpenAIP values + the OpenStreetMap postal address) into `airport_facts`, so the detail page reads values from the database instead of fetching them live per request; the live OpenAIP / AWC / Nominatim fetches are **fallbacks** for ICAOs (or fields) not yet backfilled. `airport_facts` therefore also carries `street` / `postcode` / `phone` (OSM address, backfilled with `GEOCODE=1`) and `fuel` / `opening_hours` / `ppr` / `aerodrome_type` / `restaurant` / `customs` (OpenAIP). All server-rendered; the weather + wind boxes are the only lazy (client-fetched) part. The location + aerodrome-data values also feed the enriched Airport JSON-LD (geo, address, `sameAs`, `hasMap`, `additionalProperty`).
- **Wind components (crosswind/headwind)** - `src/components/airport-wind.tsx` + `src/lib/crosswind.ts`. A per-runway head/tail- and cross-wind breakdown computed by pure trigonometry from the field's **own** reported wind (never the nearest-station substitute) and the runway bearings (parsed from the designator, e.g. `06/24` -> 060°/240°), plus a **server-rendered compass SVG** (runway lines + wind arrow, no client JS). Renders nothing without a numeric wind direction (VRB skipped) or runways. The runways come from the merged aerodrome facts above, so AWC alone is enough to drive it.
- **Contact address (OpenStreetMap)** - `src/lib/geocode.ts`. The contact/location box also shows a postal **address** (street/postcode/town), **coordinates** and a contact **phone**, reverse-geocoded from **OpenStreetMap (Nominatim)** server-side (cached 30 days, fail-soft, descriptive `User-Agent` per their usage policy). The wrapper geocodes the **best available coordinates** (the facts row, else the METAR station), so the address resolves even before the OurAirports importer has run; opening hours also fall back to OSM `opening_hours` when OpenAIP has none. OurAirports/OpenAIP carry no postal address.
- **Map ("airports near me")** - `src/components/airport-map.tsx`, embedded on the **airport-list** page. A **Leaflet + OpenStreetMap-tiles** map plotting every chart-linked field that has coordinates (`QUERIES.airportsWithCoords` joins `airports` ⋈ `airport_facts`), popups link to the detail page, and a geolocation **"locate me"** button. Leaflet is a client dep loaded only in `useEffect` (never SSR - it needs `window`); the server-rendered airport list is the indexable no-JS fallback. Only rendered when the importer has populated coordinates (so it stays absent in the DB-less CI build/E2E). OSM tile host is in the CSP `img-src`.
- **PWA** - `src/app/manifest.ts` emits `/manifest.webmanifest` so the site is installable (e.g. on an EFB tablet).

New i18n namespaces backing these - `Weather` (incl. `decode`, `openingHours`), `Common` (`viewOnMap`, `lastUpdated`, `location`, `website`, `address`, `coordinates`, `phone`, `map`, `locate`) and `TradeAero` - exist in **every** locale file; the i18n parity check (`scripts/check-i18n.mjs`) forces a newly added country to ship them too. Product/roadmap notes live in `docs/pilot-wishlist.md`.

## Styling

- **Tailwind CSS v3** with custom theme
- **Custom colors**:
  - `drossblue`: `#2d6a9a` (primary brand color), light: `#4084b8`
  - `drossgray`: `#f0f2f2` (background), dark: `#626262`
- **Font**: Tahoma, Verdana, sans-serif
- **shadcn/ui**: new-york style, Radix UI primitives, Lucide icons
- **CSS Variables**: Used for shadcn theme tokens (background, foreground, etc.)
- **Dark mode**: class-based (configured but not actively used)

## Environment Variables

### Server-side (required)
| Variable          | Description                     |
|-------------------|---------------------------------|
| CRON_SECRET       | Bearer token for API auth (Worker secret) |
| ADSENSE_ID        | Google AdSense publisher ID     |
| OPENAIP_API_KEY (optional) | OpenAIP core API key for the embedded aerodrome-facts card (`x-openaip-api-key`); unset = OurAirports + AWC (NOAA) only. Without it the card still fills coordinates / elevation / runways / frequencies from AWC (free, no key), but loses fuel / PPR / opening hours / circuit direction |

The database is a Cloudflare **D1 binding** (`DB` in `wrangler.jsonc`), not env vars. OpenNext caching uses the `NEXT_INC_CACHE_R2_BUCKET` (R2) and `NEXT_TAG_CACHE_D1` (D1) bindings. `NODE_ENV` is set as a plain `var`.

### Client-side
None currently. (`NEXT_PUBLIC_BUILD_DATE` is optionally stamped at build time - see `src/lib/build-info.ts` - but read directly, not via `src/env.js`.)

### Tooling-only (Drizzle Kit push/studio against remote D1)
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN` (read in `drizzle.config.ts`).

- Env validation via `@t3-oss/env-nextjs` + Zod (src/env.js)
- Skip validation with `SKIP_ENV_VALIDATION=true` (used by CI build/typecheck)
- Secrets/vars for local `pnpm preview` go in `.dev.vars` (see `.dev.vars.example`); production secrets via `wrangler secret put`, plain vars via `wrangler.jsonc`.
- When adding a new var: update `.env.example` (and `.dev.vars.example`), add it to `server`/`client` + `runtimeEnv` in `src/env.js`, and set it on the Worker.

## Crawlers (Python Subsystem)

- Located in `/crawlers/`
- **Runtime**: Python 3.12+ with `uv` package manager
- **Hosting**: netcup root server, scheduled by systemd (`aip-crawler.service` + `aip-crawler.timer`). The crawlers are **never** deployed to Vercel; treat the website and the crawlers as two independent deploy targets that communicate only over HTTP.
- **Dependencies**: `httpx`, `bs4`, `pydantic`, `pydantic-settings` (the path all active crawlers use); `playwright` (JS-rendering fallback, DK only - browser installed separately with `uv run playwright install chromium`); `selenium`, `webdriver-manager` (legacy, kept only for the experimental/unscheduled crawlers)
- **Base classes** (the Selenium → httpx migration is complete for every active crawler; the legacy bases linger only for experimental ones):
  - **`crawlers/crawlers/http_base.py` → `HttpCrawlerBase`** - preferred. Wraps an `httpx.Client` (pooled, redirects, sane UA), exposes `fetch()`, `soup()`, `get_frame_src()`, `follow_frame_chain()`, `clean_text()`, and `save_response()` for post-mortem debugging. Also `use_browser_headers()` (WAF'd sources) and `use_proxy()` (Bright Data proxy / Web Unlocker zone). `fetch()` is HTML-only: it refuses image/binary URLs and content types (keeps metered-proxy traffic minimal). No browser.
  - **`crawlers/crawlers/http_eurocontrol_base.py` → `HttpEurocontrolBase`** - extends `HttpCrawlerBase` with `extract_airports_from_html()`, the BS4 parser for the eurocontrol-style eAIP navigation HTML (NL, UK, FR all share it).
  - **`crawlers/crawlers/playwright_base.py` → `PlaywrightCrawlerBase`** - extends `HttpCrawlerBase` with `render_html(url)`, a headless-Chromium (Playwright) render for **client-rendered JS** sources (DK/Naviair; future JS-viewer AIPs). The one allowed browser fallback - runs ONLY on the netcup host / self-hosted runner, **never** on the Worker. `playwright` is imported lazily inside `render_html`, so importing a crawler never needs the browser; a missing/unlaunchable browser raises `PlaywrightUnavailable`, which crawlers catch to fail soft (0 airports, no crash). The BS4 helpers apply to the rendered DOM.
  - **`crawlers/crawlers/crawler_base.py` → `CrawlerBase`** *(legacy, Selenium)* - no active crawler inherits from it anymore (DE was ported to `HttpCrawlerBase`); kept only for the experimental crawlers. Re-exports `Airport` from `models.py` so old imports keep working.
  - **`crawlers/crawlers/eurocontrol_base.py` → `EurocontrolBase`** *(legacy, Selenium)* - orphaned after the NL/UK/FR ports; kept until `crawler_base.py` is deleted.
- **Output**: Posts crawled airports to the Next.js API via `OutputHandler`
- **Crawler env vars**: `API_ENDPOINT`, `API_KEY`, `LOG_LEVEL`, `LOG_FILE`. Optional Bright Data zones for blocked sources: `BRIGHTDATA_PROXY_URL` (plain proxy - clears IP blocks), `BRIGHTDATA_UNLOCKER_URL` (Web Unlocker - solves captchas + JS; GR prefers this over the plain proxy). Both are used through `use_proxy()`; credentials are never logged or committed.

When adding a new country crawler, inherit from `HttpCrawlerBase` (or `HttpEurocontrolBase` if the source is a eurocontrol eAIP). For a **client-rendered JS** source with no server-side HTML, inherit from `PlaywrightCrawlerBase` and render with `render_html()` (DK is the reference). For a **server-side captcha** gate (GR/HASP), route through the Bright Data Web Unlocker zone (`BRIGHTDATA_UNLOCKER_URL`) - Playwright alone cannot solve it. **Do not** introduce Puppeteer (Node-only) or run any browser inside a Worker/Vercel function - the browser lives with the crawlers on netcup.

## Deployment

### Cloudflare Workers (current)
- Deploy with `pnpm deploy` (runs `opennextjs-cloudflare build` then `deploy`). Local end-to-end preview with `pnpm preview` (miniflare + local D1/R2).
- One-time resource setup: `wrangler d1 create aip-aero`, `wrangler d1 create aip-aero-tag-cache`, `wrangler r2 bucket create aip-aero-inc-cache` (R2 must be enabled on the account first), then paste the returned D1 IDs into `wrangler.jsonc`. Set the secret with `wrangler secret put CRON_SECRET` (and `ADSENSE_ID`).
- **CD:** `.github/workflows/cd.yml` (self-hosted) deploys on push to `main`: applies D1 migrations then `opennextjs-cloudflare deploy`. Auth via `CLOUDFLARE_API_TOKEN` (needs edit on Workers Scripts, R2 Storage, D1, and Workers Routes) and `CLOUDFLARE_ACCOUNT_ID` repo secrets.
- Apply DB schema: `wrangler d1 migrations apply DB --local` (preview) / `--remote` (prod).
- The GH Actions CI runs the OpenNext build (`pnpm cf-build`) - no DB needed. Cutover is preview-first: validate on a `workers.dev`/preview URL (site + crawler POST), then repoint `aip.aero` DNS.

### Docker (legacy)
- Multi-stage `Dockerfile` (deps → build → runner), `docker-compose.yml` exposing `127.0.0.1:8080:3000`.
- `next.config.mjs` sets `output: "standalone"` for this image.
- Runs `db:push` during the Docker build.
- Kept for local container testing only; the netcup host no longer serves the website.

## Conventions

- **Never use em-dashes (`—`) anywhere** - not in user-facing content/translations (`messages/*.json`), docs (`*.md`), code comments, or copy. Use a spaced hyphen (` - `), a comma, or parentheses instead. This is a hard style rule for the project. (Exception: a literal `"—"` used as functional parsing data in code, e.g. `str.replace("—", "")` in the crawler base, is not prose and must be left as-is.)
- Prefer editing existing files over creating new ones; do not add new top-level docs unless asked.
- Keep components colocated under `src/components`; primitives go in `src/components/ui`.
- Server-only logic belongs under `src/server` (`"use server"` actions, DB access, secrets).
- For new translated strings, update **all** locale files in `messages/` (including `*-EN` variants) so builds don't break.
- Use `pnpm` - never `npm` or `yarn` (lockfile is `pnpm-lock.yaml`).
- Don't introduce Node-specific runtime APIs in code that may run on Vercel's edge runtime (`middleware.ts`).

## Key Patterns

1. **Static Generation**: All pages use `generateStaticParams()` + `dynamicParams = false`
2. **Airport Detail via Search Params**: Airport selection uses query string key (e.g., `?EDNY`) rather than path segments
3. **Translation-driven UI**: Menu items, page content, SEO metadata all from i18n JSON files
4. **Conditional Page Rendering**: Country-specific pages filtered in `generateStaticParams()` (e.g., IFR only for DE, military/aeroports only for FR)
5. **Path alias**: `~/*` maps to `./src/*`
6. **Type safety**: Strict TypeScript, Zod validation on API inputs, Drizzle typed queries

## Common Gotchas

- The `type` field in the airports table uses specific enum values: `vfr`, `ifr`, `heliport`, `mil`, `aeroport`
- France uses `aeroport` and `mil` types instead of `vfr`/`ifr`/`heliport`
- The sitemap path `/2d6a9a/` is intentionally obfuscated
- Airport detail URLs use search param keys without values: `/vfr?ICAO-CODE` not `/vfr?code=ICAO-CODE`. This `?ICAO` scheme is an **intentional SEO strategy** - never convert it to path segments, and keep these URLs in the multilingual sitemap (see SEO section).
- Locale pages lose their meta description / OG tags if `setRequestLocale(locale)` runs *after* `getMessages()`/`getTranslations()` - it forces dynamic rendering and OpenNext/Workers then serves the page without prerendered `<head>` metadata (see SEO section).
- Locale `uk` means United Kingdom (not Ukrainian) - it's the default locale
- The `slug` field is auto-generated: uses ICAO code if available, otherwise slugified title
- The `searchAirports` server action only supports types `vfr`, `ifr`, `heliport` (not `mil` or `aeroport`)
- `CrawlerBase` (Selenium) spins up Chromium in `__init__`, which makes it impossible to import in environments without a browser (CI runners, serverless functions). Always inherit from `HttpCrawlerBase` for new crawlers.
- The DE crawler (`de.py`) enters DFS BasicVFR/BasicIFR at static section index pages (`…/pages/CNNNNN.html`) and stores each airport's amendment-stable `myPermalink` (`const myPermalink = "pages/CNNNNN.html"`) rather than the physical, edition-specific URL (`…/<AIRAC>/chapter/<hash>.html`) that DFS renames every AIRAC cycle - so saved links survive amendments. The VFR folder-link hrefs are already those permalinks, so no per-airfield fetch is needed (only an edition-specific href triggers a leaf fetch to read `myPermalink`).
