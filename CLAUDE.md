# CLAUDE.md - AIP:Aero Project Knowledge Base

## Project Overview

**AIP:Aero** (https://aip.aero) is a website that simplifies the search for Aeronautical Information Publications (AIPs), approach charts, and airport data for VFR, IFR, heliports, military aerodromes, and French aeroports across multiple European countries.

- **Author**: Alexander Dross
- **Stack**: T3 Stack (Next.js + Drizzle ORM + Tailwind CSS), bootstrapped with `create-t3-app` v7.38.1
- **Package Manager**: pnpm (v10.8.1)
- **Node**: 22 on Vercel; the legacy `Dockerfile` still uses `node:21-alpine`

## Hosting (split architecture)

The system runs on **two hosts** by design — do not try to consolidate them:

- **Website (`src/`) → [Vercel](https://vercel.com).** The new `aip.aero` is served from Vercel via the GitHub integration. Treat all Next.js code as serverless: no persistent filesystem at runtime, no long-running request handlers, no Chromium/Selenium. New env vars must be added to `.env.example`, validated in `src/env.js`, and set in the Vercel project settings.
- **Crawlers (`crawlers/`) → [netcup](https://www.netcup.eu/) root server.** The Python scrapers continue to run on the existing netcup VM under systemd (`aip-crawler.service` + `aip-crawler.timer`). They are **not** deployed to Vercel — serverless is the wrong model for scheduled, long-running scraping. They reach the website by HTTP, posting to `https://aip.aero/api/airports` with `CRON_SECRET`.
- **Legacy:** the website used to run on the same netcup host via Docker (`Dockerfile` + `docker-compose.yml`). Those files are kept for local container testing only; the netcup host no longer serves the website.
- `next.config.mjs` currently sets `output: "standalone"` (left over from the Docker image). Vercel ignores it — leave it in place unless explicitly asked to change.

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

# Database
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema to database
pnpm db:studio    # Open Drizzle Studio
./start-database.sh  # Local MySQL via Docker (reads .env)
```

Always run `pnpm check` before declaring a code change complete.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request to `main` and on every push to `main`. Two parallel jobs:

| Job | Steps |
| --- | --- |
| **Website (Next.js)** | `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm format:check` |
| **Crawlers (Python)** | `uv lock --check` → `uv sync --frozen` → `python -m compileall` → import smoke test for AT/FR/NL/UK |

Notes / known gaps:

- **Lint is not yet gated.** `pnpm lint` (`next lint`) drops into an interactive setup prompt because `.eslintrc.mjs` imports the `typescript-eslint` package, which isn't installed, *and* uses the legacy ESLint config filename for an ESLint 9 flat config. Fix the config separately, then add a lint step to the website job.
- **`pnpm build` is not run in CI.** The build pre-renders sitemaps, which hit MySQL, and CI has no DB. Vercel builds every PR via the GitHub integration and posts its own status check — make that check required in branch protection if you want to gate merges on a successful build.
- **DE crawler is now part of the import smoke test.** It was the last Selenium holdout; ported to `HttpCrawlerBase` in this commit. The legacy `crawler_base.py` / `eurocontrol_base.py` files remain in the tree only for the experimental belgium / car_sam_nam / pac_n / pac_p / run crawlers (none currently in production); they can be removed once those are either ported or pruned.

To gate merges on these checks, enable branch protection on `main` in repo settings → *Branches* → *Branch protection rules* (or *Rules → Rulesets*), and mark `Website (Next.js)`, `Crawlers (Python)`, and (optionally) `Vercel` as required status checks.

## Architecture

```
Crawlers (Python, netcup) ── POST + CRON_SECRET ──▶ /api/airports (Vercel)
                                                       │
                                                       ├─▶ insert server action ──▶ MySQL
                                                       └─▶ revalidate cache
Website (Vercel) ──▶ read server action ──▶ cache ──(miss)──▶ MySQL
```

### Data Flow
1. **Python crawlers** scrape AIP websites for airport data. All five active country crawlers (AT, DE, FR, NL, UK) run on `httpx` + BeautifulSoup. The crawler subsystem also retries transient HTTP failures with exponential backoff, and `OutputHandler` refuses to publish if the new airport count drops > 50% from the last successful run (override with `CRAWLER_FORCE_PUBLISH=1`).
2. Crawlers POST airport data to `/api/airports` (authenticated via `CRON_SECRET` Bearer token).
3. The API validates with Zod, enriches with slugs, deletes existing country data, inserts new data.
4. Cache is invalidated via `revalidateTag()` on insert.
5. Website pages query the DB with Next.js `"use cache"` directive (hours lifetime).

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
│   │       ├── index.ts           # Drizzle + MySQL2 connection pool
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
│   │   ├── crawler_base.py        # CrawlerBase (Selenium, legacy — DE only)
│   │   ├── eurocontrol_base.py    # EurocontrolBase (Selenium, legacy — orphaned)
│   │   ├── at.py                  # Austria — HttpCrawlerBase
│   │   ├── nl.py                  # Netherlands — HttpEurocontrolBase
│   │   ├── uk.py                  # United Kingdom — HttpEurocontrolBase
│   │   ├── fr.py                  # France — HttpEurocontrolBase
│   │   ├── de.py                  # Germany — CrawlerBase (Selenium)
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
    ├── next.config.mjs            # standalone output, trailingSlash, useCache
    ├── tailwind.config.ts         # Custom colors (drossblue, drossgray)
    ├── tsconfig.json              # Strict mode, path alias ~/
    ├── drizzle.config.ts          # MySQL dialect, aip-aero_* table filter
    ├── components.json            # shadcn/ui config (new-york, lucide)
    ├── .eslintrc.mjs              # TypeScript ESLint + Drizzle rules (broken — see CI notes)
    ├── prettier.config.js         # Prettier + Tailwind plugin
    ├── Dockerfile                 # Multi-stage build (deps, build, runner) — legacy
    └── docker-compose.yml         # Single service, port 8080:3000 — legacy
```

## Database

- **Engine**: MySQL (mysql2 driver)
- **ORM**: Drizzle ORM
- **Table prefix**: `aip_aero_v4_`
- **Main table**: `aip_aero_v4_airports`
  - `id` (bigint, PK, auto-increment)
  - `icao` (varchar 4, nullable) - ICAO airport code
  - `title` (varchar 256, not null) - Airport name
  - `url` (varchar 512, not null) - Link to AIP/approach chart
  - `type` (enum: 'vfr' | 'ifr' | 'heliport' | 'mil' | 'aeroport')
  - `country` (varchar 2, not null) - Country code (UK, DE, FR, NL, AT)
  - `slug` (varchar 256, not null) - URL-friendly identifier (ICAO or slugified title)
- **Indexes**: icao, title, type, country, slug

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
| Austria        | AT   | `AT`          | `HttpCrawlerBase`     | no              | Austro Control eAIP   |
| Germany        | DE   | `DE`          | `HttpCrawlerBase`     | no              | DFS BasicVFR/BasicIFR |
| France         | FR   | `FR`          | `HttpEurocontrolBase` | no              | SIA eAIP              |
| Netherlands    | NL   | `NL`          | `HttpEurocontrolBase` | no              | LVNL eAIP             |
| United Kingdom | UK   | `UK`          | `HttpEurocontrolBase` | no              | NATS eAIP             |

All five active country crawlers (AT, DE, FR, NL, UK) are off Selenium. The legacy `crawler_base.py` and `eurocontrol_base.py` modules remain only for the experimental `belgium.py` / `car_sam_nam.py` / `pac_n.py` / `pac_p.py` / `run.py` files — none of which are currently scheduled in `main.py`'s active list. Once those experimental crawlers are either ported to `HttpCrawlerBase` or removed, the legacy bases plus `selenium` / `webdriver-manager` can come out in one cleanup commit.

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

- Uses Next.js experimental `"use cache"` directive
- Cache lifetime: `hours` (via `unstable_cacheLife`)
- Cache tags per query type: `vfrAirports`, `ifrAirports`, `heliports`, `militaryAirports`, `aeroportAirports`, `airport`, `airports`
- Invalidated on data insert via `revalidateTag()`

## SEO

- Extensive JSON-LD structured data: BreadcrumbList, Product, Airport, WebSite, SiteNavigationElement, WebPage
- Dynamic sitemaps per country at `/2d6a9a/sitemap/<country>.xml`
- Sitemap index at `/2d6a9a/sitemap.xml` (rewritten from `/2d6a9a/index.xml`)
- Canonical URLs, alternate language links, OpenGraph, Twitter cards
- `trailingSlash: true` in Next.js config
- Static generation with `dynamicParams = false` and `generateStaticParams()`
- Airport detail pages use search params: `/vfr?EDNY` (slug as query key, no value)

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
| DATABASE_HOST     | MySQL host                      |
| DATABASE_PORT     | MySQL port (default: 3306)      |
| DATABASE_USER     | MySQL user                      |
| DATABASE_PASSWORD | MySQL password                  |
| DATABASE_NAME     | MySQL database name             |
| CRON_SECRET       | Bearer token for API auth       |
| ADSENSE_ID        | Google AdSense publisher ID     |

### Client-side (required)
| Variable                   | Description            |
|----------------------------|------------------------|
| NEXT_PUBLIC_AXIOM_DATASET  | Axiom logging dataset  |
| NEXT_PUBLIC_AXIOM_TOKEN    | Axiom logging token    |

- Env validation via `@t3-oss/env-nextjs` + Zod (src/env.js)
- Skip validation with `SKIP_ENV_VALIDATION=true` (useful for Docker builds and CI lint/typecheck)
- When adding a new var: update `.env.example`, add it to both `server`/`client` and `runtimeEnv` in `src/env.js`, and remember to set it in the Vercel project settings.

## Crawlers (Python Subsystem)

- Located in `/crawlers/`
- **Runtime**: Python 3.12+ with `uv` package manager
- **Hosting**: netcup root server, scheduled by systemd (`aip-crawler.service` + `aip-crawler.timer`). The crawlers are **never** deployed to Vercel; treat the website and the crawlers as two independent deploy targets that communicate only over HTTP.
- **Dependencies**: `httpx`, `bs4`, `pydantic`, `pydantic-settings` (preferred path); `selenium`, `webdriver-manager` (legacy, kept until DE is ported)
- **Base classes** (two parallel hierarchies during the in-flight Selenium → httpx migration):
  - **`crawlers/crawlers/http_base.py` → `HttpCrawlerBase`** — preferred. Wraps an `httpx.Client` (pooled, redirects, sane UA), exposes `fetch()`, `soup()`, `get_frame_src()`, `follow_frame_chain()`, `clean_text()`, and `save_response()` for post-mortem debugging. No browser.
  - **`crawlers/crawlers/http_eurocontrol_base.py` → `HttpEurocontrolBase`** — extends `HttpCrawlerBase` with `extract_airports_from_html()`, the BS4 parser for the eurocontrol-style eAIP navigation HTML (NL, UK, FR all share it).
  - **`crawlers/crawlers/crawler_base.py` → `CrawlerBase`** *(legacy, Selenium)* — only DE still inherits from it. Re-exports `Airport` from `models.py` so old imports keep working.
  - **`crawlers/crawlers/eurocontrol_base.py` → `EurocontrolBase`** *(legacy, Selenium)* — orphaned after the NL/UK/FR ports; kept until `crawler_base.py` is deleted.
- **Output**: Posts crawled airports to the Next.js API via `OutputHandler`
- **Crawler env vars**: `API_ENDPOINT`, `API_KEY`, `LOG_LEVEL`, `LOG_FILE`

When adding a new country crawler, inherit from `HttpCrawlerBase` (or `HttpEurocontrolBase` if the source is a eurocontrol eAIP). **Do not** introduce Puppeteer (Node-only) or run a browser inside a Vercel function. If a future AIP genuinely requires JS rendering (e.g. potentially CZ / GR / HR from the open task list), add a single Playwright (Python) fallback path.

## Deployment

### Vercel (current)
- Auto-deploys via the Vercel GitHub integration on pushes to the production branch.
- Required env vars are managed through the Vercel project settings and must mirror `.env.example`.
- Vercel's preview build runs on every PR and posts a status check — make it required in branch protection if you want to gate merges on a successful build (the GH Actions CI deliberately does not run `pnpm build`).
- The MySQL database is reachable from Vercel's serverless functions over the public network — make sure the database host whitelists Vercel's egress and that connections use TLS.

### Docker (legacy)
- Multi-stage `Dockerfile` (deps → build → runner), `docker-compose.yml` exposing `127.0.0.1:8080:3000`.
- `next.config.mjs` sets `output: "standalone"` for this image.
- Runs `db:push` during the Docker build.
- Kept for local container testing only; the netcup host no longer serves the website.

## Conventions

- Prefer editing existing files over creating new ones; do not add new top-level docs unless asked.
- Keep components colocated under `src/components`; primitives go in `src/components/ui`.
- Server-only logic belongs under `src/server` (`"use server"` actions, DB access, secrets).
- For new translated strings, update **all** locale files in `messages/` (including `*-EN` variants) so builds don't break.
- Use `pnpm` — never `npm` or `yarn` (lockfile is `pnpm-lock.yaml`).
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
- Airport detail URLs use search param keys without values: `/vfr?ICAO-CODE` not `/vfr?code=ICAO-CODE`
- Locale `uk` means United Kingdom (not Ukrainian) - it's the default locale
- The `slug` field is auto-generated: uses ICAO code if available, otherwise slugified title
- The `searchAirports` server action only supports types `vfr`, `ifr`, `heliport` (not `mil` or `aeroport`)
- `CrawlerBase` (Selenium) spins up Chromium in `__init__`, which makes it impossible to import in environments without a browser (CI runners, Vercel functions). Always inherit from `HttpCrawlerBase` for new crawlers.
