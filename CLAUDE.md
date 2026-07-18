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
- **Crawlers (`crawlers/`) → self-hosted GitHub Actions runner** (the runner lives on the Coolify/[netcup](https://www.netcup.eu/) box and also runs the crawler live-test). The Python scrapers run as scheduled workflows - `.github/workflows/crawl.yml` (daily, POSTs to `/api/airports`) and `facts-import.yml` (weekly, OurAirports → `/api/airport-facts`) - both manually triggerable. This replaced the old bare-metal systemd timer (`aip-crawler.service`/`.timer`): Actions checks out fresh each run (no code drift), gives run logs + a manual trigger, and installs headless Chromium per run for the DK Playwright fallback (no crawler Dockerfile needed). They are **not** deployed to Workers - serverless is the wrong model for scheduled, browser-capable scraping. They reach the website by HTTP with `CRON_SECRET`; the drop guard's `last_run_counts.json` is persisted across runs via `actions/cache`.
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
pnpm check:countries # Assert the per-country lists still cover every live country (drift guard)
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

| Job                                    | Steps                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Website (Next.js)**                  | `pnpm install --frozen-lockfile` → `typecheck` → `format:check` → `lint` → i18n parity → live-country coverage → `test` (vitest) → `audit` (high+) → `cf-build` (OpenNext Worker build)                                                                                                                                                             |
| **Crawlers (Python)**                  | `uv lock --check` → `uv sync --frozen` → `python -m compileall` → import smoke test for all 12 country crawlers → `pytest`                                                                                                                                                                                                                         |
| **E2E & rendered output (Playwright)** | `pnpm build` → `pnpm test:e2e` (Playwright, Chromium) against a `next start` server: rendered-output **SEO** contract (meta description in `<head>` & unique, canonical/OG/Twitter, `<main>`, `<html lang>`), **axe** accessibility, **JSON-LD** structured-data validity, user **flows** (search, locale switch, 404), and **sitemap** structure. |
| **Lighthouse budgets (local)**         | `pnpm build` → start `pnpm start` → `treosh/lighthouse-ci-action` against localhost URLs with budgets from `.lighthouserc.cjs` (SEO + a11y gate, best-practices + performance warn).                                                                                                                                                               |

Notes:

- **The OpenNext build is now gated in CI** (`pnpm cf-build`). It no longer needs a database: DB reads go through the `DB` D1 binding, which at build time is a local empty D1, so reads fail-soft to empty results and revalidate at runtime. Vercel no longer builds PRs.
- **E2E tests run against `next start`** (production Node build), which is the only local server that reproduces production streaming-metadata `<head>` placement - the exact behaviour the `htmlLimitedBots` fix guards. The tests are black-box (`e2e/`), the page matrix in `e2e/pages.ts` mirrors `src/i18n/routing.ts`, and the DB is absent (reads fail-soft) so airport-row-dependent happy paths (`?ICAO` detail, sitemap airport entries) are left to the deployed Lighthouse run. Locally, point Playwright at a pre-installed Chromium with `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm test:e2e`.
- **`lighthouse.yml`** stays a manual `workflow_dispatch` run against any deployed URL (`base_url` input) - e.g. a `workers.dev` preview or `aip.aero`; it shares the `.lighthouserc.cjs` budgets. PR-time Lighthouse gating is the `lighthouse` job in `ci.yml` against a local server.
- **All 12 active crawlers are covered by the import smoke test.** They run on httpx/BeautifulSoup (DK walks the Naviair Umbraco JSON API with httpx; its Playwright render remains only as a self-diagnosing fallback); Selenium is gone - the legacy `crawler_base.py` / `eurocontrol_base.py` bases, the experimental crawlers (belgium / car_sam_nam / pac_n / pac_p / run) and the `cache_warmer.py` script were removed along with the `selenium` / `webdriver-manager` deps.

To gate merges on these checks, enable branch protection on `main` in repo settings → _Branches_ → _Branch protection rules_ (or _Rules → Rulesets_), and mark `Website (Next.js)`, `Crawlers (Python)`, `E2E & rendered output (Playwright)` and `Lighthouse budgets (local)` as required status checks.

## Architecture

```
Crawlers (Python, self-hosted runner) ─ POST + CRON_SECRET ─▶ /api/airports (CF Worker)
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
│   │   ├── page.tsx                # Root page (/) - country selector landing + global search + WebSite SearchAction
│   │   ├── not-found.tsx           # Global 404
│   │   ├── api/airports/route.ts   # POST endpoint for crawler data ingestion
│   │   ├── api/airport-coords/     # GET map markers (client-fetched, per locale)
│   │   ├── 2d6a9a/                 # Sitemap (obfuscated path)
│   │   │   ├── sitemap.ts          # Dynamic sitemap per country
│   │   │   └── index.xml/route.ts  # Sitemap index XML
│   │   └── [locale]/
│   │       ├── layout.tsx          # Locale layout (Header, Footer, i18n, site-wide JSON-LD)
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
│   │   ├── menu.tsx                # Desktop navigation (server component, NavLink islands)
│   │   ├── mobile-menu.tsx         # Mobile navigation: scrollable pill bar (server component)
│   │   ├── nav-link.tsx            # Client link with aria-current="page" active state
│   │   ├── box.tsx                 # Card component for country/type selection
│   │   ├── about-box.tsx           # About section container
│   │   ├── about-country-box.tsx   # Country-specific about section
│   │   ├── search-input-field.tsx  # Per-country search input (client component, debounced)
│   │   ├── global-search-input-field.tsx # Homepage cross-country search (client, debounced; ?ICAO deep-link + SearchAction target)
│   │   ├── title.tsx               # Page title/description component
│   │   ├── breadcrumbs.tsx         # Server-rendered breadcrumb trail + BreadcrumbList JSON-LD (rendered by the pages)
│   │   ├── external-link.tsx       # External link with noopener/noreferrer
│   │   ├── locale-switcher.tsx     # Language switcher (RSC wrapper: SchemaWebpage + links)
│   │   ├── locale-switcher-links.tsx  # Language toggle as plain links (no dropdown JS)
│   │   ├── loading-sub.tsx         # Loading skeleton
│   │   ├── hero.tsx                # Shared hero band (title + optional search)
│   │   ├── value-props.tsx         # Trust strip on the global homepage
│   │   ├── section-heading.tsx     # Deep-linkable gadget headings (#wetter)
│   │   ├── schemas/                # JSON-LD structured data
│   │   │   ├── schema-airport.tsx  # Airport schema
│   │   │   ├── schema-digital-document.tsx # DigitalDocument (chart PDF)
│   │   │   ├── schema-product.tsx  # Product schema
│   │   │   ├── schema-sitenav.tsx  # SiteNavigationElement schema
│   │   │   ├── schema-webpage.tsx  # WebPage schema
│   │   │   └── schema-website.tsx  # WebSite schema
│   │   └── ui/                     # shadcn/ui components (new-york style)
│   │       ├── input.tsx
│   │       └── skeleton.tsx
│   ├── i18n/
│   │   ├── routing.ts             # Locale config, pathnames, mappings
│   │   └── request.ts             # next-intl request config
│   ├── lib/
│   │   ├── utils.ts               # cn(), orgUrl, constants, i18nPathMapping
│   │   ├── nav-items.ts           # Shared header nav entries (desktop menu + mobile pill bar)
│   │   ├── fonts.ts               # Inter via next/font (--font-sans, no preload)
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
  - `pdf_url` (text, nullable) - Direct link to the exact chart PDF where the crawler captured one (chart-PDF plan Stage 2); the site falls back to `url` when null
  - `type` (text with enum: 'vfr' | 'ifr' | 'heliport' | 'mil' | 'aeroport')
  - `country` (text, not null) - Country code (UK, DE, FR, NL, AT)
  - `slug` (text, not null) - URL-friendly identifier (ICAO or slugified title)
- **Indexes**: icao, title, type, country, slug
- **Migrations**: generated by `pnpm db:generate` into `drizzle/`, applied to D1 with `wrangler d1 migrations apply DB` (`--local` for the preview DB, `--remote` for production). The old Docker `db:push`-against-MySQL step is gone.

## Internationalization (i18n)

- **Library**: next-intl v4
- **Locales**: `at`, `at-EN`, `de`, `de-EN`, `fr`, `fr-EN`, `nl`, `nl-EN`, `uk`
- **Default locale**: `uk` (United Kingdom / English)
- **Locale prefix mode**: `always` (every URL has a locale prefix)
- **Custom prefixes**: `at-EN` -> `/at/en`, `de-EN` -> `/de/en`, etc.
- **Locale detection**: enabled, cookies disabled
- **Translation files**: `messages/<locale>.json`

> The three reference tables below (Locale Mappings, Page Availability, Localized Pathnames) list the **founding five** countries as worked examples. The **live source of truth** is code, not this doc: locales/prefixes/slugs in `src/i18n/routing.ts`, per-country page types in `countryTypeAvailability`, and which countries are launched in `liveCountries` (all in `src/lib/utils.ts`). Newer countries (BE, CZ, DK, GR, NO, PL, SE, LT, RS, IE, SK, BA, CH, AL, MK, RO, CY, MT, MD) follow the same shape - e.g. LT: locales `lt`/`lt-EN`, prefix `/lt/en`, VFR only, slug `/oro-uostu-sarasas-lietuva`; RS: locales `rs`/`rs-EN`, prefix `/rs/en`, VFR only, slug `/lista-aerodroma-srbija`; IE: single English locale `ie` (like uk/be), VFR only, slug `/airport-list-ireland`; SK: locales `sk`/`sk-EN`, prefix `/sk/en`, VFR only, slug `/letiska-slovensko`; BA: locales `ba`/`ba-EN`, prefix `/ba/en`, VFR only, slug `/lista-aerodroma-bih`; CH: locales `ch`/`ch-EN` (German native), prefix `/ch/en`, VFR only, slug `/flugplaetze-schweiz`, an **info-page** (gated - links the skybriefing portal, no chart crawl); AL: locales `al`/`al-EN` (Albanian native), prefix `/al/en`, VFR only, slug `/aeroportet-shqiperi`; MK: locales `mk`/`mk-EN` (Macedonian native), prefix `/mk/en`, VFR only, slug `/aerodromi-severna-makedonija` (M-NAV open eAIP, 2 international fields); RO: locales `ro`/`ro-EN` (Romanian native), prefix `/ro/en`, VFR only, slug `/lista-aeroporturi-romania` (AISRO static DOCS tree, 35 fields, browser headers); CY: locales `cy`/`cy-EN` (Greek native), prefix `/cy/en`, VFR only, slug `/aerolimenes-kypros` (DCA "Open Cyprus VFR Manual", a bespoke static frameset - `cy.py` reads `menu.html` for each aerodrome's `charts/VFR_CHART_<ICAO>.pdf`; 2 civil fields LCLK/LCPH, 100% chart coverage; NOT gated); MT: single English locale `mt` (like uk/ie/be, bilingual but English-official), VFR only, slug `/airport-list-malta`, an **info-page** (gated - the MATS AIP portal is a JS app, links Transport Malta's AIP page, no chart crawl); MD: locales `md`/`md-EN` (Romanian native, Moldovan = Romanian), prefix `/md/en`, VFR only, slug `/lista-aeroporturi-moldova`, an **info-page** (gated - the MOLDATSA `aim.moldatsa.md` portal is Home-Briefing-registration-gated, no chart crawl).

### Locale Mappings

| Locale | Language | Country |
| ------ | -------- | ------- |
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

| Page          | UK  | DE  | FR  | NL  | AT  |
| ------------- | --- | --- | --- | --- | --- |
| /vfr          | Y   | Y   | N   | Y   | Y   |
| /ifr          | N   | Y   | N   | N   | N   |
| /heliports    | Y   | Y   | N   | Y   | Y   |
| /military     | N   | N   | Y   | N   | N   |
| /aeroports    | N   | N   | Y   | N   | N   |
| /airport-list | Y   | Y   | Y   | Y   | Y   |
| /efb          | Y   | Y   | Y   | Y   | Y   |

`/efb` exists for **every** locale with a uniform slug: the EFB guide (`src/app/[locale]/efb/page.tsx`, i18n namespace `EfbPage`) explains PWA install, offline saves, country packs, chart-PDF import into ForeFlight/SkyDemon & Co., the open-in hand-offs and the on-page weather briefing. Static, SSR-only, linked from the footer nav group and included in the sitemap automatically (it iterates `routing.pathnames`). Per-locale meta title/description carry the country name for uniqueness - the e2e SEO test enforces global meta-description uniqueness across the whole page matrix.

**Legal pages are ROOT-level, single-language pages paired by topic OUTSIDE `[locale]`** (owner decision, 18.07.2026): English at `/terms`, `/imprint`, `/privacy`; German at `/agb`, `/impressum`, `/datenschutz` (native slugs German users actually search). One clean canonical URL per language, NOT localized into every site locale - they are legal/compliance pages, not SEO landing pages. Each pair is cross-linked with a language toggle + `hreflang` alternates (`en`/`de`/`x-default`->English). They live at `src/app/{terms,agb,imprint,impressum,privacy,datenschutz}/page.tsx`, render their own `<html>`/`<body>` + Header + `<Footer global />` via the shared `src/components/legal-shell.tsx`. The shell's `lang` prop drives both `<html lang>` AND the site-chrome locale (`setRequestLocale`): English pages pin `"uk"`, German pages `"de"` (so a German legal page gets a German header/footer). Pinning the locale also keeps them STATIC / prerendered (otherwise next-intl falls back to `headers()` -> dynamic render, and on Workers only prerendered pages reliably carry their `<head>` metadata). Content is hardcoded single-language JSX - so they are NOT in `routing.pathnames`, NOT in the i18n message files, and NOT in the per-country sitemap. Provider data (VAT/tax/contact) + the privacy service links + the `AIP_SOURCES` cc-keyed attribution (rendered on BOTH terms pages) live in `src/lib/legal.ts` (drift-guarded by `check-live-countries-coverage.mjs`, which reads `src/lib/legal.ts`). The old `/<locale>/terms` URLs 301-redirect to `/terms` in `middleware.ts` (regex `^/[a-z]{2}(?:/en)?/(terms|imprint|privacy)/?$`). The footer's legal links point at the fixed root paths (German slugs on the `de`/`at`/`ch` locales, English otherwise) with their existing localized labels (`Footer.{terms,imprint,privacy}.title`). Contact e-mail (`mail@dross.net`) is shown but hyperlinked to `dross.net/contact`; the responsible person's name links to `dross.net/alexander/`.

### Localized Pathnames

- `/airport-list` has country-specific slugs:
  - `at`: `/flughafen-liste-oesterreich`
  - `de`: `/flughafen-liste-deutschland`
  - `fr`: `/liste-des-aeroports-francais`
  - `nl`: `/luchthavenlijst-nederland`
  - `uk`: `/airport-list-uk`

## Supported Countries

| Country              | Code | Crawler Class | Base                    | Browser?                                         | AIP Source                  |
| -------------------- | ---- | ------------- | ----------------------- | ------------------------------------------------ | --------------------------- |
| Austria              | AT   | `AT`          | `HttpCrawlerBase`       | no                                               | Austro Control eAIP         |
| Germany              | DE   | `DE`          | `HttpCrawlerBase`       | no                                               | DFS BasicVFR/BasicIFR       |
| France               | FR   | `FR`          | `HttpEurocontrolBase`   | no                                               | SIA eAIP                    |
| Netherlands          | NL   | `NL`          | `HttpEurocontrolBase`   | no                                               | LVNL eAIP                   |
| United Kingdom       | UK   | `UK`          | `HttpEurocontrolBase`   | no                                               | NATS eAIP                   |
| Belgium/Luxembourg   | BE   | `BE`          | `HttpEurocontrolBase`   | no                                               | skeyes eAIP                 |
| Czechia              | CZ   | `CZ`          | `HttpEurocontrolBase`   | no                                               | ANS CR (rlp.cz) eAIP        |
| Denmark              | DK   | `DK`          | `PlaywrightCrawlerBase` | no (JSON API; render = diagnostic fallback only) | Naviair Umbraco JSON API    |
| Greece               | GR   | `GR`          | `HttpCrawlerBase`       | no (static PDF tree via plain Bright Data proxy) | HASP (aisgr) static AIP tree |
| Norway               | NO   | `NO`          | `HttpEurocontrolBase`   | no                                               | Avinor eAIP                 |
| Poland               | PL   | `PL`          | `HttpEurocontrolBase`   | no                                               | PANSA eAIP                  |
| Sweden               | SE   | `SE`          | `HttpEurocontrolBase`   | no                                               | LFV eAIP                    |
| Lithuania            | LT   | `LT`          | `HttpCrawlerBase`       | via Web Unlocker                                 | ANS Lithuania (ans.lt) eAIP |
| Serbia (+Montenegro) | RS   | `RS`          | `PlaywrightCrawlerBase` | yes (JS-rendered AD page)                        | SMATSA public VFR AIP       |
| Ireland              | IE   | `IE`          | `HttpEurocontrolBase`   | no                                               | AirNav Ireland eAIP         |
| Slovakia             | SK   | `SK`          | `HttpEurocontrolBase`   | no                                               | LPS SR eAIP                 |
| Bosnia & Herzegovina | BA   | `BA`          | `HttpEurocontrolBase`   | no                                               | BHANSA eAIP                 |
| Switzerland          | CH   | `CH`          | `HttpCrawlerBase`       | no (info-page: OurAirports list, no chart crawl) | skybriefing (login-gated)   |
| Albania              | AL   | `AL`          | `HttpEurocontrolBase`   | no                                               | Albcontrol eAIP             |
| North Macedonia      | MK   | `MK`          | `HttpCrawlerBase`       | no                                               | M-NAV eAIP (ais.m-nav.info) |
| Romania              | RO   | `RO`          | `HttpCrawlerBase`       | no (static DOCS tree; browser headers)           | AISRO (aisro.ro) static AIP |
| Cyprus               | CY   | `CY`          | `HttpCrawlerBase`       | no (static VFR-manual tree)                      | DCA "Open Cyprus VFR Manual" |
| Malta                | MT   | `MT`          | `HttpCrawlerBase`       | no (info-page: OurAirports list, no chart crawl) | Transport Malta / MATS (gated) |
| Moldova              | MD   | `MD`          | `HttpCrawlerBase`       | no (info-page: OurAirports list, no chart crawl) | MOLDATSA AIM (registration-gated) |

All twenty-five active country crawlers run on httpx (RS and DK via Playwright); none use Selenium. The legacy Selenium bases (`crawler_base.py`, `eurocontrol_base.py`), the experimental crawlers (`belgium.py` / `car_sam_nam.py` / `pac_n.py` / `pac_p.py` / `run.py`) and the `cache_warmer.py` script have been removed, together with the `selenium` / `webdriver-manager` dependencies. The **LT** crawler is `HttpCrawlerBase` (not eurocontrol): the ANS Lithuania eAIP is WAF'd, so it routes through the Bright Data Web Unlocker (`BRIGHTDATA_UNLOCKER_URL`) and resolves the AIRAC edition path itself (supplements page -> `start.html` -> index -> eAIP base), then parses AD 1.3 for the ICAO list and reads per-airport `EY-AD-2-<ICAO>-en-US.html` (VAC charts preferred). It also merges the separate open **AIP VFR LITHUANIA** for the small VFR fields the eAIP omits (LT **4 -> 29**; see "Separate VFR manuals" below). LT customs is not yet verified (AD 1.3 INTL recon pending, issue #31) - OpenAIP fills it until then. The **RS** crawler is `PlaywrightCrawlerBase`: SMATSA's free public VFR AIP (the IFR eAIP is paywalled) publishes a bespoke frameset whose AD page (`.../vfraip/published/htm/ad.html`) is client-rendered, so it is rendered with headless Chromium; every aerodrome's artifacts are PDFs (`VFR_LY_AD_2_<KEY>_<section>_en.pdf`) grouped by KEY (ICAO or field name), VAC preferred then ADC. The joint Serbia/Montenegro AIP includes a few Montenegrin fields (Podgorica/Tivat/Nikšić); names come from the AD 1.3 index.

**Country onboarding candidates that are paywalled / blocked (14.07.2026; re-probed 16.07.2026 - all three still gated):** Croatia (Crocontrol) moved its eAIP behind the AIM-portal subscription on 01.01.2026 (now 401); Serbia's IFR eAIP (SMATSA) is a subscription "Order Form" too - but the free **public VFR AIP** (SMATSA, a bespoke frameset `.../upload/vfraip/published/htm/ad.html` linking `VFR_LY_AD_2_<...>_en.pdf` under `/pdf/adr/`) **is now onboarded** as country RS (its own `PlaywrightCrawlerBase` crawler, see the Supported Countries table). **Greece is now onboarded (15.07.2026)** - the earlier "dead end via Bright Data" verdict was wrong about the whole host: `main.php` is captcha-gated and Bright Data 502s that dynamic `.gov` page, BUT each AIRAC edition is a **static self-contained tree** (`aipgr_incl_amdt_<NNYY>_wef_<date>/cd/ais/`) whose deep paths **proxy through the plain Bright Data proxy at 200** (no Web Unlocker/JS-render needed). `gr.py` (now `HttpCrawlerBase`, not eurocontrol) derives the current edition from the AIRAC 28-day schedule by probing the static folders (skipping main.php), reads `AIP-menu.htm` (700+ direct PDF links), and harvests AD 2 aerodrome VFR charts (type `vfr`) + AD 3 heliport charts (type `heliport`, name-only Greek island helipads in one `HELIPORTS/` folder). Live: 41 aerodromes + 45 heliports, 100% chart coverage. **Ireland and Slovakia are also onboarded (15.07.2026)** - they were never truly blocked, just wrongly classified: the old Irish host `iaip.iaa.ie` was retired (the ANSP is now **AirNav Ireland**, an open eurocontrol eAIP at `www.airnav.ie`, per-chapter AD-2, crawler `ie.py`, 22 fields); and the Slovak AIS portal `aim.lps.sk` is session-PHP but its **AIP SR page publicly links the currently effective eurocontrol eAIP frameset** (`LZ-frameset-en-SK.html`) with no login (crawler `sk.py`, 5 fields). Both are `HttpEurocontrolBase`, no proxy, live. **Bosnia and Herzegovina is onboarded too (15.07.2026)** - BHANSA publishes a standard eurocontrol eAIP at `eaip.bhansa.gov.ba` whose edition folder is date-stamped (`<YYYY-MM-DD>-AIRAC/html/index.html`), so `ba.py` derives the current edition from the AIRAC schedule (skipping the JS root) and reads the per-airport AD 2 (4 international aerodromes: LQBK/LQMO/LQSA/LQTZ) + AD 4 (13 small VFR fields, the Slovenia pattern) chapters, all `vfr`, deduped by ICAO; flat frame chain `["eAISNavigation"]`, no proxy, live: 17 fields, 4/17 chart-PDF coverage (the 4 international fields carry AD 2.24 charts; the AD-4 VFR fields carry a text AD entry only). **Switzerland is onboarded as an info-page (15.07.2026)** - skybriefing (a skyguide company) publishes the official Swiss AIP + charts behind a login/registration, so we deliberately do NOT crawl charts (respecting the access control). Instead `ch.py` (`HttpCrawlerBase`) reads the Swiss aerodrome list from OurAirports (CC0), emits each LS** field as a `vfr` row whose `url` is the skybriefing AIP portal (`https://www.skybriefing.com/en/aip`, verified 200 via the live-test `check_urls`) with no `pdf_url`; the website adds OpenAIP data + weather per ICAO and shows a "registration may be required" hint next to the AIP button (CH is in `gatedCountries` in `src/lib/utils.ts` - the general mechanism for login/paywall AIP portals). Live: 67 aerodromes, 0 charts by design. **Albania is onboarded (15.07.2026)** - Albcontrol publishes a standard eurocontrol eAIP linked from `www.albcontrol.al/aip/` (that landing page lists dated editions, path `/al/aip/<DD-MON-YYYY>/<YYYY-MM-DD>-(AIRAC|NON-AIRAC)/html/`). `al.py` (`HttpEurocontrolBase`) resolves the effective edition by date, fetches the `eAIP/LA-menu-en-GB.html` nav frame directly (deterministic path, the classic 3-frame layout so no frame-name walk), and reads AD 2 (aggregate then per-chapter fallback) - Albania's 2 international aerodromes LATI (Tirana) + LAKU (Kukës), all `vfr`. Live: 2 aerodromes, 2/2 chart-PDF coverage (25 charts). (Historical note: the Web Unlocker returns `HTTP 400 - Access denied: aisgr.hasp.gov.gr is classified as Government` on the bare host - a blanket Bright Data `.gov` policy - which once looked like a dead end for GR; the fix was to stop touching the dynamic landing entirely and proxy the static edition tree with the PLAIN proxy instead, see the Greece paragraph above.) The remaining realistic-fallback candidates (IT/HR) are OurAirports (CC0) info-pages without chart links - an open owner product decision. **Italy (ENAV)** is registration-gated too (recon 14.07.2026, run 29352948630): there is no open eurocontrol eAIP - `www.enav.it/eAIP/` 404s, `aip.enav.it` does not resolve, and the only aeronautical entry point is the login-only **Self Briefing** portal (`www.enav.it/cosa-facciamo/spazio-aereo/self-briefing`); OpenAIP is the interim source. **Re-probe 16.07.2026 (run 29510248413)** confirmed all three are still gated: Croatia's public static eAIP tree (`www.crocontrol.hr/UserDocsImages/AIS produkti/eAIP/<edition>/html/...`, which search engines still index for the Jan-2026 edition) now returns **404** for the edition folders and `aim.crocontrol.hr` is a bare login portal - consistent with the announced full AIM-portal transition, so Croatia is an info-page candidate only (respect the gate, no chart crawl); Bulgaria (BULATSA) serves a login/registration services page that hands off to the `b-flip.bulatsa.com` AIP portal (registration-gated, no open AD-2); Italy unchanged (`www.enav.it/eAIP/` 404, `aip.enav.it` no DNS). **Deep re-verification 18.07.2026 (a real-charts crawl was attempted then reverted, PR #313 -> #314):** both IT and BG are gated at the *navigation* layer, not just the landing. ENAV's `onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/` static tree - `default.html` AND the dated edition folders (`(A<NN>-<YY>)_<YYYY>_<MM>_<DD>/eAIP/LI-menu-en-GB.html`) - 302-redirects to **Oracle IDCS SSO** (`identity.oraclecloud.com/sso/v1/user/login`), even under a legacy-TLS handshake + headless render (0 links). BG's b-flip renders a **Keycloak** login page (`<html class="login-pf" ... noindex,nofollow>`) and its `/_aip/AD_files/LB_AD_1_3_en.pdf` index is **403**. The individual chart PDFs are reachable only from an authenticated browser; there is no open static tree (the Greece exception does NOT apply) and no login-free enumeration source, so **both stay OurAirports info-pages** (respect the gate). Getting charts would need a licence / open feed from ENAV / BULATSA, or via EUROCONTROL EAD - requested by the owner on a strict **link-only, never re-host** basis (outreach 18.07.2026, see `docs/aip-hosting-rights.md`). Do NOT scrape behind the login or wire in credentials. **Separate VFR manuals** (issue #35): several countries publish most small VFR fields in a standalone VFR manual, NOT the eurocontrol AD-2 eAIP the crawler reads. Each is a per-country merge on top of the eAIP crawler (the API delete+inserts per country, so one crawler owns the whole country), deduped by ICAO, fully fail-soft. Harvested so far:

- **CZ** - ANS CR VFR Manual (its eAIP carries only ~11 IFR aerodromes); `cz.py` `_crawl_vfr_manual`.
- **PT** - NAV Portugal eVFR Manual, a Portuguese-only eurocontrol frameset under the `eVFR_Current` alias; `pt.py` `_crawl_evfr` (fetches `LP-menu-pt-PT.html` directly, `extract_airports_per_chapter`). PT went **19 -> 83** (39 vfr + 44 AD-3 heliports; heliports page enabled).
- **HU** - HungaroControl VFR Manual, a bespoke HTML table at `ais-en.hungarocontrol.hu/vfrmanual` (ICAO / name / per-field chart PDF on `storage.hungarocontrol.hu`); `hu.py` `_crawl_vfr_manual` parses the table, emits each storage-PDF row as a VFR field (name-only when it has no ICAO), skips rows that link back to the eAIP ("AIP"). HU went **8 -> 73** (all vfr, `url`/`pdf_url` = the chart PDF).
- **LT** - the open "AIP VFR LITHUANIA" (its eAIP lists only the 4 international aerodromes). A flat PDF tree at `ans.lt/a1/aip_vfr/aip_vfr_<edition>/` (no Web Unlocker needed for this open dir) whose landing page links one chart PDF per field under `pdf/<placename>.pdf`; `lt.py` `_resolve_vfr_edition` (newest dated edition) + `_crawl_vfr_manual` parse it, drop GEN/ENR/AMDT front matter, group a field's extra sheet (`paluknys_av`) as a second chart, and emit name-only vfr fields (no ICAO in the source). LT went **4 -> 29** (25 VFR fields).
- **SI** - Slovenia files most small VFR aerodromes / airstrips under **AD 4** (distinct from the AD 2 aerodromes) in the same eAIP; `si.py` extracts the AD 4 section (`_AD4_SECTION_IDS` / `_AD4_CHAPTER_RE`), deduped against AD 2. SI went **4 -> 16**. (Not a separate manual, but the same "small VFR fields the AD-2 list omits" gap.)

**Per-country page/type availability is data-driven** from `countryTypeAvailability` in `src/lib/utils.ts` (the single source of truth): the country landing cards (`[locale]/page.tsx` via `t.has`), the search-page `generateStaticParams`, the sitemap, the menus and the SiteNavigation schema all derive from it. The **global homepage's** country cards / hreflang links / about-text links derive from `liveCountries` x `countryMeta` (both in `src/lib/utils.ts`) - no per-country edit in `src/app/page.tsx`. Adding a country = one row in `countryTypeAvailability` + one in `countryMeta` + a GEN 1.2 customs check (run `crawler-live-test.yml` with `gen12: <CC>` - generic for eurocontrol eAIPs - and fill `customs-overrides.ts` from the output) + its two translation files (native + `-EN`; a single English locale like `uk`/`be` has no `-EN` partner) + a crawler + a `routing.ts` locale/prefix/slug entry; **launching** it (once the crawler is verified) = un-commenting its line in `liveCountries`. **Drift guard:** several hand-maintained per-country lists must include every launched country - the Terms-page AIP-source attribution (`AIP_SOURCES` in `terms/page.tsx`, keyed by a machine-readable `cc`), the e2e page matrix (`e2e/pages.ts`), and the `crawl.yml`/`cd.yml` warm-up URL lists. `scripts/check-live-countries-coverage.mjs` (run as `pnpm check:countries`, wired into CI right after the i18n parity check) derives `liveCountries` and fails with the exact missing codes if any of those lists falls behind - so a newly launched country cannot silently drop out of the Terms attribution, the warm-up, or the tests. **The warm-up + verify lists carry BOTH the native list URL AND the English-locale list URL** (`/<cc>/en/airport-list-...`) for every two-locale country: the native and English list pages are SEPARATE prerenders (same country-tagged data, but HTML cached per route), so an un-warmed English list served the empty build seed while the native one was filled - the `it/en/airport-list-italy` empty-list bug, 18.07.2026 (the map still worked because it is client-fetched from `/api/airport-coords`). `x-default` points at the English page, so it must never be empty; `check:countries` has a matching **English-locale coverage check** (the 44 two-locale countries) so a new country cannot ship its English list unwarmed. The BE/CZ/DK/GR crawlers follow their `crawlers/tasks/*` specs; **NO/PL/SE have no task spec - their endpoints and eAIP section ids are best-effort and must be validated against the live source before the scheduled crawl relies on them.**

## API Endpoint

### POST `/api/airports`

- **Auth**: Bearer token (`CRON_SECRET` env var)
- **Body**: Array of airport objects (validated via Zod/drizzle-zod)
  ```json
  [
    {
      "icao": "EDNY",
      "title": "Friedrichshafen",
      "url": "...",
      "type": "vfr",
      "country": "DE"
    }
  ]
  ```
- **Behavior**: Deletes all existing airports for the country, then bulk inserts new data
- **Cache**: Invalidates all cache tags after insert

### `/api/airport-facts` (aerodrome facts ingest + missing-list read)

- **Auth**: Bearer `CRON_SECRET` (both methods).
- **POST**: array of facts rows (`airportFactsApiInsertSchema`), upserted by ICAO (`MUTATIONS.upsertAirportFacts`, `COALESCE`-preserving on the enrichment columns). Used by `crawlers/import_ourairports.py` and the OpenAIP backfill.
- **GET**: `{ count, missing: [{icao, country, title}] }` - every airport that has an ICAO but **no `airport_facts` row** (`QUERIES.airportsMissingFacts`, uncached). Read by the OpenAIP coord backfill (`crawlers/import_openaip_backfill.py`) so it only queries OpenAIP for the fields OurAirports never carried (hospital heliports / small ULM strips) instead of all ~3k. See the Aerodrome-facts gadget + `docs/data-backfill-runbook.md` section C.

### Public data API (`/api/v1/*`, key-gated, read-only)

A structured read-only JSON API offered to integration partners (EFB / flight-planning vendors), advertised on the Pilot-Tools & EFB page (`EfbPage.apiTitle`/`apiText`). Auth + CORS helpers live in `src/lib/api-auth.ts` (`apiKeyError()` is pure/unit-tested, `API_CORS` = any-origin GET).

- **Auth**: shared Bearer token `PUBLIC_API_KEY` (optional Worker secret). **Inert by default**: when the secret is unset every endpoint returns **503 "API not configured"**, so deploying the routes exposes nothing until a key is provisioned (`wrangler secret put PUBLIC_API_KEY`). Wrong/missing Bearer -> 401.
- **`GET /api/v1/airports/{country}`** - a live country's aerodrome index: `{ country, count, airports: [{icao, title, type, slug, url, pdfUrl}] }`. Reuses the website's cached `QUERIES.airportsByCountry` (no extra DB load), 404 for a non-live country, `Cache-Control: public, max-age=3600`.
- **`GET /api/v1/airport/{ICAO}`** - one aerodrome: the AIP/chart links (`url`, `pdfUrl`, full captured `charts[]`) merged with its `airport_facts` (coords, elevation, runways, frequencies, fuel, opening hours, PPR, customs, ...) under a `facts` sub-object. 400 for a malformed ICAO, 404 when not held. Both routes fail soft on DB errors and carry an `OPTIONS` preflight handler.

## Server Actions

### `searchAirports` (src/server/actions.ts)

- Used by `SearchInputField` client component (the per-country search on the search pages)
- Validates: search (1-50 chars), country (2 chars), type (vfr/ifr/heliport)
- Returns up to 5 matching airports via `QUERIES.airports()`

### `searchAirportsGlobal` (src/server/actions.ts)

- Powers the **global cross-country search on the homepage** (`GlobalSearchInputField` in `src/app/page.tsx`) - type any airport name or ICAO ("EDNY", "Friedrichshafen") and jump straight to its native-locale detail page (`/de/vfr/?EDDF`), no country pre-selection needed. So a **global search already exists**; the homepage is not a "pick a country first" gate.
- Validates search (1-50 chars) only (no country/type filter), returns matches across **all** countries/types via `QUERIES.airportsGlobal()` (uncached, like the per-country as-you-type search - one call per settled keystroke burst).
- Also the target of the **WebSite `SearchAction`** (Google Sitelinks Search Box) JSON-LD on the root page: the `?{search_term}` valueless-query scheme (`https://aip.aero/?EDNY`, mirroring the `?ICAO` detail URLs) is read on mount by `GlobalSearchInputField` and executed, so a Sitelinks search lands on results directly.

## Caching Strategy

- Reads are wrapped in Next's `unstable_cache` (in `src/server/db/queries.ts`). The newer `"use cache"` directive is **not** used - the OpenNext Cloudflare adapter doesn't support it yet.
- Cache lifetime: `revalidate: 86400` (24h). Freshness on real changes comes from on-demand `revalidateTag`, not the timer - so the timer is only a safety net and stays long to avoid needless rewrites.
- Each read carries a per-country tag `country:<CC>` (plus a query tag like `airportsByCountry`). The airport-list page, the sitemap and `/api/airport-urls` all share ONE cached read per country (`QUERIES.airportsByCountry`, full rows partitioned by type in JS) - do not reintroduce per-type list queries: five separate reads meant five tag-cache checks + D1 misses + R2 writes per regeneration, measured live as a multi-second streamed-content delay after a tag bust. The as-you-type search (`QUERIES.airports`) is uncached.
- Invalidated on data insert via a single `revalidateTag(\`country:<CC>\`)` - a crawler POST (always one country) busts only that country's entries, not all ~1k across every country.
- On Workers this is backed by OpenNext's incremental cache (R2, `NEXT_INC_CACHE_R2_BUCKET`) and tag cache (D1, `NEXT_TAG_CACHE_D1`), configured in `open-next.config.ts`.
- **ISR revalidation needs a `queue` in `open-next.config.ts`** (memory queue + the `WORKER_SELF_REFERENCE` service binding in `wrangler.jsonc`). Without it the adapter installs a dummy queue that throws `FatalError: Dummy queue is not implemented` on every stale-page hit, and the `export const revalidate = 3600` safety net below can never refresh a page (observed in production 10.07.2026).
- During `next build` the OpenNext adapter exposes a local (empty) D1 binding; DB reads that fail at build return empty and revalidate at runtime (`IS_BUILD` guard in `queries.ts`), so the build needs no database.
- **Deploys seed EMPTY prerenders** (the build has no DB), which would serve empty airport lists/sitemaps until the next crawler POST. Three-layer self-heal: (1) build-written data-cache entries carry a 1h TTL (`BUILD_SEED_REVALIDATE_SECONDS` in `queries.ts` - not lower: a page's ISR interval is the MINIMUM of route revalidate and every cache TTL used at build, so a tiny TTL would make all prerendered pages rewrite that often); (2) `POST /api/revalidate` (Bearer `CRON_SECRET`) busts all `country:<CC>` tags and is called by the CD workflow after every deploy (needs the `CRON_SECRET` **repo secret**; fail-soft warning without it); (3) `export const revalidate = 3600` on `airport-list/page.tsx` and `2d6a9a/sitemap.ts` bounds staleness to 1h even if (2) and the crawlers are unavailable. Do NOT bypass `unstable_cache` during the build - the prerendered pages would lose their country tags and the on-demand `revalidateTag` flow would break.

## SEO

- Extensive JSON-LD structured data: BreadcrumbList, Product, Airport, WebSite, SiteNavigationElement, WebPage, DigitalDocument (chart PDFs)
- The site-navigation JSON-LD is one **multi-typed node** `"@type": ["SiteNavigationElement", "CollectionPage", "ItemList"]` carrying the nav entries directly via `itemListElement` (each entry a `SiteNavigationElement` with `position`) - on the global homepage inline and via `schema-sitenav.tsx` for the locale pages
- Dynamic sitemaps per country at `/2d6a9a/sitemap/<country>.xml` (live countries only - all onboarded countries are now live incl. gr, ie, sk as of 15.07.2026)
- `/llms.txt` (llmstxt.org, GEO): LLM-friendly Markdown site summary served by `src/app/llms.txt/route.ts`, generated from `liveCountries` x `countryMeta` x `countryTypeAvailability` (launching a country updates it automatically); static, no DB. robots.txt explicitly welcomes the AI crawlers and mentions it (the obfuscated sitemap path deliberately stays out of robots.txt)
- Sitemap index at `/2d6a9a/sitemap.xml` (rewritten from `/2d6a9a/index.xml`)
- **Sitemap `lastmod` is the real crawl timestamp**: both the per-country sitemap (`2d6a9a/sitemap.ts`) and the sitemap index (`2d6a9a/index.xml/route.ts`) set `lastModified` from `QUERIES.crawlUpdatedAt(country)` (the `aip_aero_v4_crawl_meta` timestamp, unix seconds -> Date), falling back to the build date for not-yet-crawled countries - so search engines see a truthful last-changed date per country instead of the deploy time. Threaded through both the page entries and the per-airport entries.
- **IndexNow** (`src/lib/indexnow.ts`, key `fae2b7dc9cfb44919eb6b358e7c4a846` served at `/<key>.txt`; `INDEXNOW_KEY` is a plain `var` in `wrangler.jsonc`): on each crawler POST, `MUTATIONS.insertAirports` pings IndexNow (Bing/Yandex) with the changed country's URLs via `ctx.waitUntil(submitCountryToIndexNow(...))` - but **only when the insert actually changed detail rows** (`if (changedDetails.length > 0)`), so an unchanged re-crawl does not ping. The submit retries 429/503 with jittered exponential backoff (`MAX_ATTEMPTS=3`, `BACKOFF_BASE_MS=3000`) - a fix for the 429 storm caused by 19 countries all pinging on the same daily schedule. See `docs/indexnow-concept.md`.
- Canonical URLs, alternate language links + **`x-default`** (pointing at the English version) on the country/list/search pages and in the sitemap; single-locale countries (uk, be - `isSingleLocale()` in `routing.ts`) emit **no** alternates and hide the language switcher
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

Since Next.js 15.2, metadata is **streamed** by default: on **dynamically rendered** routes it is emitted at the end of the stream (inside `<body>`) and only hoisted into `<head>` by client-side React - _unless_ the request's user agent matches Next's built-in `htmlLimitedBots` list (Googlebot is deliberately **not** on it, since Google renders JS). The search / airport-detail routes (`/vfr`, `/ifr`, `/heliports`, `/military`, `/aeroports`) read `searchParams` for the `?ICAO` scheme, so they are dynamic - meaning their `<meta name="description">`, OG and Twitter tags stream into `<body>`, and Lighthouse / crawlers that read the raw `<head>` see no description. `next.config.mjs` sets **`htmlLimitedBots: /.*/`** (match every UA) to disable streaming metadata and emit it blocking in `<head>` for all requests. Verified with `pnpm start` by diffing the byte offset of `<meta name="description">` against `</head>` across Googlebot / plain-Chrome / Chrome-Lighthouse user agents. Trade-off: a small TTFB increase on dynamic pages (metadata resolves before the first byte) - acceptable for these SEO pages, and static pages are unaffected.

### JSON-LD gotcha: site-wide schemas live in `[locale]/layout.tsx` (rendered DIRECTLY, no Suspense) + `SchemaDedupe` - do NOT move them back into pages

On the Workers runtime, JSON-LD `<script>`s emitted **directly by a dynamically rendered page** (the search routes) were **duplicated** in the served HTML - the schema.org validator showed 2 elements each. The source emits every node exactly once; the doubling is a Cloudflare/OpenNext dynamic-render artifact. Therefore the site-wide `SchemaWebsite` + `SchemaSitenav` are rendered from `src/app/[locale]/layout.tsx` (the global homepage, outside `[locale]`, keeps its own inline copies). Page-specific schemas (BreadcrumbList, Product, Airport, DigitalDocument) stay in the pages/gadgets. **These site-wide schemas are rendered DIRECTLY, NOT inside `<Suspense>`** (14.07.2026): wrapping them in a Suspense boundary made OpenNext stream them as a late chunk that client hydration re-inserted as a SECOND `<script>` in the JS-rendered DOM (the validator showed WebSite/SearchAction twice; the RAW served HTML was already correct with one node, so Googlebot's raw read was fine). They are synchronous server components, so Suspense bought nothing but that duplicate. `src/components/schema-dedupe.tsx` (`SchemaDedupe`, client) is the belt-and-braces: it removes byte-identical duplicate JSON-LD `<script>`s after hydration AND via a bounded `MutationObserver` (catches the page-emitted BreadcrumbList/Product that OpenNext can still double on dynamic routes, even if inserted late).

### LocaleSwitcher gotcha: ICU branch keys must equal the LOCALE PREFIX, not the ISO language code

`locale-switcher.tsx` resolves the native option label via `t("locale", { locale: <prefix> })` with the URL locale prefix (`se`, `cz`, `dk`, `gr`, ...). The `LocaleSwitcher.locale` ICU `select` in each `messages/*.json` must therefore key its native branch on that **prefix** - keying it on the ISO language code (`sv`, `cs`, `da`, `el`) never matches and falls through to the `other` ("Unknown", no flag) case. Countries where prefix == ISO code (de, fr, nl, at, no, pl) mask the bug; se/cz/dk/gr shipped broken this way once already. (`localeLangMapping` in `routing.ts` is the opposite: it correctly uses ISO codes, for `hreflang`.)

## Website gadgets & cross-links

Beyond the core search-and-link flow, the airport detail pages and the charts index carry a few add-ons. **Info gadgets are server-rendered (SSR) by design**; the only exceptions are plain outbound links (airport website, Google Maps), which need no server data. On the detail pages the gadgets are grouped into **three boxes** (contact/location, weather, aerodrome data) - see the wrapper below.

- **Weather (METAR/TAF)** - `src/components/airport-weather.tsx` + `src/lib/weather.ts`. Decoded METAR/TAF fetched **server-side** from the NOAA / Aviation Weather Center API (`aviationweather.gov`, free, no key), cached ~10 min via the OpenNext incremental cache, 5s timeout, fully **fail-soft** (no reporting station -> renders nothing, the common case for small VFR fields). Shows raw METAR/TAF, a decoded summary (wind/visibility/clouds/temp/QNH), the VFR/MVFR/IFR/LIFR flight-category badge and the observation time. Each raw report also carries a collapsible **decode tab** (`<details>`, no client JS) that expands it into plain-language lines via `src/lib/metar-decode.ts` (`decodeReport(raw, lang)`) - a pure, dependency-free token decoder with a built-in meteorological glossary (full en/de/fr/nl, English fallback for the other locales). The glossary lives in code, not the i18n JSON (fixed standard vocabulary, not site copy); only the toggle label is an i18n key (`Weather.decode`).
- **Airport gadgets wrapper** - `src/components/airport-gadgets.tsx`, rendered on all five detail pages (`vfr`/`ifr`/`heliports`/`military`/`aeroports`) below the chart link. Fetches weather + facts **once** and passes them into the boxes: **contact/location** (`airport-contact.tsx` - town + website from OurAirports, plus the **Google Maps** link, which resolves the field by coordinates when known else by ICAO/name query, and the **border-crossing form link** from `src/lib/border-crossing.ts` - VERIFIED official links only, UK GAR first; a wrong link is a compliance hazard, so no best-effort entries), **weather** (`airport-weather.tsx`), **aerodrome data** (`airport-facts.tsx` - elevation, runways, frequencies, opening hours, and today's sunrise/sunset/civil twilight computed locally from the facts coordinates, with the METAR station as a fallback source for elevation/coords), and **nearby airfields** (`airport-nearby.tsx`). `mt-24` clears the absolutely-positioned chart link. The wrapper also renders the **Trade:Aero CTA** between the facts grid and the weather box, and both the wrapper and its streaming fallback (`airport-gadgets-fallback.tsx`) carry a matching **`min-h-[40rem]`** on the region root so the fallback-to-real swap and the lazy weather box's appear/collapse happen inside the reserved height (footer CLS fix - keep the two values in sync).
- **Nearby airfields** - `src/components/airport-nearby.tsx`. The closest chart-linked fields of the same country (max 4, within 100 km), server-rendered. Uses the **bounded box query `QUERIES.airportsNear(country, lat, lon, latDelta, lonDelta)`** so SQLite returns only the fields inside a lat/lon bounding box (the haversine pass then refines to the exact circle). It must NEVER go back to loading the whole country's coordinate set into the render - that full-country in-memory load was an Error-1102 (Worker memory) cause. The query is deliberately **uncached** (a per-airport box would create unbounded cache entries; same reasoning as the as-you-type search). Agreed escalation if Error 1102 ever recurs: move this box fully client-side behind a small API endpoint, like the map/weather.
- **Chart-PDF box** - `src/components/airport-chart.tsx`, shown when the airport's `url` points directly at a PDF (`isPdfUrl`). Server-rendered, **links-only**: the primary chart's "open PDF" link plus an honest designation + AIRAC-date line, and every other captured chart (SIDs/STARs/IACs...) in a collapsed `<details>` list of open links. Each chart's raw source code is spelled out for the reader via `chartDisplayName` (`src/lib/charts.ts`): a standard ICAO designator token in the name becomes its full localized meaning (`IAC 7` -> `IAC 7 - Instrument Approach Chart`, en/de/fr/nl). Only **verified** codes are in the glossary - unambiguous ICAO designators plus state codes confirmed against the source's own chart title (e.g. ENAIRE's `PDC` = Aircraft Parking/Docking, `TRAN` = Approach Transition, read from the AD 2-LEBL PDFs); a genuinely ambiguous/unverified code stays raw (a wrong chart label is safety-relevant). **There is NO inline PDF preview** (the former `chart-preview.tsx` `<object>` embed was removed 14.07.2026): a cross-origin AIP PDF in `<object>`/`<embed>` is unreliable - many AIP hosts block framing and mobile browsers do not render PDFs inline (it showed an empty box), and it only ever previewed ONE chart while the open links already reach every PDF. Do NOT reintroduce an inline PDF embed. When the box renders, `SchemaDigitalDocument` (`src/components/schemas/schema-digital-document.tsx`) emits the chart as `schema.org/DigitalDocument` JSON-LD (`name`/`alternateName`/`description`/`url`/`encodingFormat: application/pdf`/`isPartOf` -> the airport-detail page).
- **Chart-availability signal** - `chartCoverage(country, airports)` in `src/lib/utils.ts` drives an honest per-country note on the **airport-list** page (`AirportsPage.coverage`, an ICU `select`) and a per-field note on the **detail** pages (`Common.noChartPdf`, in `airport-gadgets.tsx`). The country note is computed from the rows the list already loaded (`QUERIES.airportsByCountry`, no extra query - so it never drifts from a hardcoded coverage table): bucket `full` (every field has a chart PDF), `partial` ({withCharts}/{total} do, the rest link their AIP entry), `none` (the authority publishes no chart PDFs, e.g. DE DFS BasicVFR HTML - the links open the official AIP pages), or `gated` (login/registration portal - ch/mt/md, from `gatedCountries`). The detail-page note renders only when a field has no direct chart PDF **and** its country is not gated (gated fields already show the `aipLoginHint` next to the AIP button). Tells users what to expect (direct charts vs AIP-page links vs a registration portal) without overselling.
- **Section anchors** - `src/components/section-heading.tsx`. Every gadget-box `<h2>` (Anflugkarte, Standort, Flugplatzdaten, Wetter, Windkomponenten, In der Naehe) is a self-anchor: the `id`/hash is slugified from the **localized** heading text (`#wetter` on de, `#weather` on en), with a `#` fading in on hover. Plain HTML anchor, no client JS, works in server- and client-rendered gadgets alike; zero new i18n keys.
- **Last updated + AIRAC** - `src/components/last-updated.tsx`, a localized date on the charts index (`airport-list`). Prefers the **real per-country crawl timestamp** (the `aip_aero_v4_crawl_meta` table, stamped in the same atomic batch as each crawler POST by `MUTATIONS.insertAirports`, read via `QUERIES.crawlUpdatedAt` with the country tag), falling back to the build stamp (`~/lib/build-info`) for countries not yet crawled since the last deploy. It also shows the **AIRAC/edition date** ("Stand: … · AIRAC …") from the `crawl_meta.airac` column (read via `QUERIES.crawlAirac`). `airac` is stamped by `insertAirports` = `airacOverride ?? mostCommonAirac(input)`: for date-in-URL sources the website derives the edition from the airports' chart/page URLs (`airacDateFromUrl`, `src/lib/charts.ts`); **DE** stores date-less amendment-stable BasicVFR permalinks, so its crawler captures the edition from the physical URL and forwards it to `POST /api/airports?airac=<iso>` (the base-class `self.airac` attribute → `OutputHandler` → the route). The **detail pages** show the same AIRAC: inside the chart-PDF box for PDF countries, and as a standalone "AIRAC …" line (via `crawlAirac` fallback) for boxless sources like DE/BE/FI. Fully fail-soft (CZ carries no date anywhere → no AIRAC line).
- **Trade:Aero cross-link** - `src/lib/trade-aero.ts` + `src/components/trade-aero-cta.tsx`. Locale + country aware deep links to the sister marketplace (`https://trade.aero`), derived entirely from the locale config so new countries roll out automatically; localized CTA on the country landing page, the airport-list page (between map and listings) and all five airport-detail pages (above the weather box, via the gadgets wrapper), plus a locale-aware footer link. Followed (`rel="noopener"`) with UTM attribution. The link is plain **inline flow** (not inline-flex): with inline-flex, the external-link icon floated detached at the right edge when the copy wrapped on mobile - keep the icon as a trailing inline-block element. See `docs/trade-aero-crosslink-concept.md`.
- **Aerodrome facts** - `src/components/airport-facts.tsx` + `src/lib/airport-facts.ts`. Embedded runways / frequencies / elevation / town / website / opening hours per ICAO, **merged** from three sources with a per-field precedence (see the `getAirportFacts` doc comment): **(1) OpenAIP** at request time when the `OPENAIP_API_KEY` secret is set (`src/lib/openaip.ts` fetch client + `src/lib/openaip-parse.ts` pure mapper, unit-tested; cached, fail-soft; richest, and the only source of fuel / PPR / opening hours / circuit direction - field names + enums verified against the authoritative public v1 schema at `api.core.openaip.net/api/schemas/response/airport/airport-schema.json`); **(2) OurAirports** base (public domain / CC0, imported into the D1 `airport_facts` table by `crawlers/import_ourairports.py` -> `POST /api/airport-facts`; the only source of `municipality` + `home_link`); **(3) AWC / NOAA** (`src/lib/awc-airport.ts`, the free no-key `aviationweather.gov` "airport" endpoint we already use for weather - an **always-on fallback** for coordinates / elevation / runways / frequencies, so the card works with no importer run and no key). **The persisted D1 row is primary** - the importer backfills the full enrichment (OpenAIP values + the OpenStreetMap postal address) into `airport_facts`, so the detail page reads values from the database instead of fetching them live per request; the live OpenAIP / AWC / Nominatim fetches are **fallbacks** for ICAOs (or fields) not yet backfilled. `airport_facts` therefore also carries `street` / `postcode` / `phone` (OSM address, backfilled with `GEOCODE=1`) and `fuel` / `opening_hours` / `ppr` / `aerodrome_type` / `restaurant` / `customs` (OpenAIP). **Fields OurAirports never carries** (hospital heliports, small ULM/private strips - ~65 as of 14.07.2026) get no persisted row from the OurAirports importer, so they are absent from the map and self-heal only when a detail page is visited (on-read write-back via `MUTATIONS.persistAirportFacts` in `after()`). The **OpenAIP coord backfill** (`crawlers/import_openaip_backfill.py`) fills them proactively: it reads the missing-ICAO list from `GET /api/airport-facts` and POSTs OpenAIP coords/elevation/runways/frequencies for the ICAOs OpenAIP resolves (mapping mirrors `openaip-parse.ts`, unit-tested). It runs **weekly** in `facts-import.yml` (apply mode, after the OurAirports import) and is also a manual dispatch (`backfill` mode, dry-run default, `apply`/`icaos` opt-in). Needs `OPENAIP_API_KEY` as a GitHub **repository** secret; see `docs/data-backfill-runbook.md` section C. All server-rendered; the weather + wind boxes are the only lazy (client-fetched) part. The location + aerodrome-data values also feed the enriched Airport JSON-LD (geo, address, `sameAs`, `hasMap`, `additionalProperty`). The `additionalProperty` entries are **granular** (`src/components/airport-gadgets.tsx`, 14.07.2026): **one PropertyValue per runway** (`name: "Runway 07C/25C"`) and **one per frequency SERVICE type** (`name: "TWR", value: "119.905, 124.855, 136.5"` - grouped so a field with three TWR frequencies stays one node), not a single semicolon blob - more precisely LLM-readable (GEO). No Google SEO effect either way (Airport.additionalProperty is not a rich-result field); this is a GEO/semantic-cleanliness choice.
- **Wind components (crosswind/headwind)** - `src/components/airport-wind.tsx` + `src/lib/crosswind.ts`. A per-runway head/tail- and cross-wind breakdown computed by pure trigonometry from the field's **own** reported wind (never the nearest-station substitute) and the runway bearings (parsed from the designator, e.g. `06/24` -> 060°/240°), plus a **compass SVG** (runway lines + wind arrow). **Owner directive (14.07.2026): the box shows for EVERY field that has a weather station (a METAR) + runways** - it gates only on `metar != null && runways.length > 0`, NOT on a numeric wind. A fixed numeric wind gets the full per-runway table + arrow; a **VRB / variable** wind (very common, e.g. LOWI/EDNY report VRB) shows the compass + runways + a "crosswind ≤ wind speed (variable)" note (the direction is undefined, so the crosswind can reach the full speed on any runway); **calm** shows the compass + "calm". i18n keys `Weather.variable` / `Weather.calm` exist in every locale. The runways come from the merged aerodrome facts above, so AWC alone is enough to drive it.
- **EFB / pilot-tool hand-offs** - `src/lib/efb-links.ts`, rendered in the contact/location box: the same field opened in SkyVector, Windy and autorouter (ICAO-keyed deep links; all patterns verified 200 from the runner via the live-test `check_urls` step). VERIFIED URL PATTERNS ONLY - same policy as the border-crossing links; app-scheme links (ForeFlight/SkyDemon) are deliberately absent (undocumented, fail silently without the app). `Common.openIn` exists in every locale.
- **Customs overrides (AIP GEN 1.2)** - `src/lib/customs-overrides.ts`: verified customs/Airport-of-Entry values live in code and WIN over OpenAIP/D1 at read time, in the facts merge AND the map-filter flags (`airport-coords` selects `icao` for the lookup). Seeded empty until entries are verified against the national GEN 1.2 (runbook section in `docs/data-backfill-runbook.md`); a wrong customs answer is a compliance hazard - never add unverified entries.
- **Contact address (OpenStreetMap)** - `src/lib/geocode.ts`. The contact/location box also shows a postal **address** (street/postcode/town), **coordinates** and a contact **phone**, reverse-geocoded from **OpenStreetMap (Nominatim)** server-side (cached 30 days, fail-soft, descriptive `User-Agent` per their usage policy). The wrapper geocodes the **best available coordinates** (the facts row, else the METAR station), so the address resolves even before the OurAirports importer has run; opening hours also fall back to OSM `opening_hours` when OpenAIP has none. OurAirports/OpenAIP carry no postal address.
- **Map ("airports near me")** - `src/components/airport-map.tsx`, embedded on the **airport-list** page. A **Leaflet + OpenStreetMap-tiles** map plotting every chart-linked field that has coordinates, popups link to the detail page, and a geolocation **"locate me"** button. The map is decorative (not indexable content), so it is aggressively deferred: markers are fetched **client-side** from `GET /api/airport-coords` (locale-keyed, 1h `Cache-Control`, fail-soft `[]`; backed by `QUERIES.airportsWithCoords`, which joins `airports` ⋈ `airport_facts`) so hundreds of coordinates never weigh down the heavy list SSR (an Error-1102 contributor); the Leaflet init + OSM tiles only load when the map scrolls near the viewport (IntersectionObserver, `rootMargin: 300px` - eager tiles made an OSM tile the LCP) **AND after the first user input** (scroll/pointer/touch/key, one-shot passive listeners): on mobile the map container sits in the INITIAL viewport, so the observer alone fired immediately and a late tile still became the LCP (4.9s, measured on the live DE list 2026-07-12; the browser finalizes LCP at first input, so input-gated tiles can never be LCP - the locate button itself triggers init via a pending-locate ref); and Leaflet's stylesheet is loaded via **dynamic `import("leaflet/dist/leaflet.css")` inside the init effect** - a top-level import would bake it into the route CSS chunk, which Next preloads on `<Link>` prefetch from other pages and Chrome then flags as "preloaded but not used". Tiles are greyscale (`.leaflet-tile-pane` grayscale filter; markers keep their colour). **Filter toggles** (fuel / customs / paved runway) sit in the map's existing control row (no extra layout height/CLS): the flags are reduced to booleans server-side in the coords API (false = "not known to have it", never a verified negative), toggles are AND-combined, markers are redrawn in a Leaflet **layer group** (never tear down the map/tiles per toggle), and the framing (`fitBounds`) stays on ALL fields; a toggle only renders when at least one marker carries its flag. The server-rendered airport list is the indexable no-JS fallback; the map renders nothing when the country has no coordinates. OSM tile host is in the CSP `img-src`. The **"locate me"** button needs geolocation enabled for our own origin: the `Permissions-Policy` header in `next.config.mjs` must be `geolocation=(self)`, NOT `geolocation=()` (an empty allowlist disables the Geolocation API site-wide and the button then fails silently).
- **PWA** - `src/app/manifest.ts` emits `/manifest.webmanifest` (installable, e.g. on an EFB tablet), and `public/sw.js` is a hand-rolled, dependency-free **offline service worker** (concept + phasing: `docs/pwa-offline-concept.md`): hashed statics cache-first, unhashed shell files (manifest/logo/offline page) stale-while-revalidate (cache-first pinned the pre-icons manifest forever and blocked Edge installability - 10.07.2026), HTML navigations network-first with a **dated "offline copy" banner** injected on cached serves (aviation-safety rule: cached content is never silently stale), `/api/airport-coords` stale-while-revalidate, OSM tiles capped cache-first, `/api/airport-weather` deliberately NOT intercepted (no stale METAR/TAF). Registered by `service-worker-registration.tsx` after `load`, **skipped on localhost** (keeps `pnpm start`/`pnpm preview`/Playwright SW-free); `/sw.js` is served `no-cache` (headers rule in `next.config.mjs`) and CSP carries `worker-src 'self'`. The offline fallback `public/offline.html` lists the downloaded country packs and saved fields (by title, from the localStorage indexes) and cached pages (its cache names / index keys must stay in sync with `sw.js`, `save-offline-button.tsx` and `save-country-offline-button.tsx`). **Explicit save** (`save-offline-button.tsx`, on all detail pages via the gadgets wrapper): pins page + direct-PDF chart in never-trimmed `saved-v1`/`charts-v1` caches, localStorage index `aip-offline-saved` doubles as the Favorites foundation; i18n keys `Common.saveOffline`/`savedOffline` exist in every locale. **Country bulk download** (Phase 4, `save-country-offline-button.tsx` on the airport-list page): saves ALL of a country's detail pages **HTML-only, never chart PDFs** (opaque-response quota padding, see the concept doc) into a per-locale `bulk-<locale>-v1` cache (never trimmed by the SW, replaced wholesale on update, pruned of removed airports); the URL list comes from the cached standalone `GET /api/airport-urls?locale=<locale>` (backed by `QUERIES.airportsByCountry`; trailing-slash canonical URLs, so the cache keys match the SW's offline navigation lookups) instead of being serialised into the heavy list SSR; quota-guarded via `navigator.storage.estimate()`, deliberately low download concurrency (3 - each detail page is a dynamic Worker render), with size estimate, progress, cancel, update and remove; indexed in localStorage `aip-offline-bulk`; i18n keys `Common.bulk*` exist in every locale.

- **Favorites / recently viewed** - `src/components/favorites-recent.tsx` (client-only section on the country landing page, below the cards and ABOVE the about box - still below the initial fold, never higher: in the initial viewport it would shift SEO content) + `src/components/recent-tracker.tsx` (renders nothing; records detail-page views into localStorage `aip-recently-viewed`, mounted via the gadgets wrapper). Favorites ARE the offline-saved fields (the `aip-offline-saved` index from the save-offline button - one implementation, per the PWA concept). Personal data, so it must never appear in the indexable SSR HTML; the below-the-cards placement keeps the post-hydration appearance below the initial fold (no LCP/CLS cost on SEO content).
- **CSP is ENFORCING** (`Content-Security-Policy` in `next.config.mjs`, promoted from Report-Only): AdSense needs the Google-documented origins (pagead2/tpc googlesyndication, googleads.g.doubleclick.net, `*.adtrafficquality.google`) or ad slots blank out, and `object-src` must stay `https:` (NOT 'none') or the chart-PDF inline preview `<object>` breaks - AIP hosts are too many/AIRAC-churning to enumerate. If a legitimate resource gets blocked, extend the allowlist; never demote back to Report-Only.

New i18n namespaces backing these - `Weather` (incl. `decode`, `openingHours`), `Common` (`viewOnMap`, `lastUpdated`, `location`, `website`, `address`, `coordinates`, `phone`, `map`, `locate`, `pavedRunway`, `favorites`, `recentlyViewed`, `borderCrossing`, the `bulk*` keys) and `TradeAero` - exist in **every** locale file; the i18n parity check (`scripts/check-i18n.mjs`) forces a newly added country to ship them too. Product/roadmap notes live in `docs/pilot-wishlist.md`.

## Styling

- **Tailwind CSS v4** (`@tailwindcss/postcss`; `globals.css` uses `@import "tailwindcss"` + an `@config` bridge to `tailwind.config.ts`)
- **Custom colors**:
  - `drossblue`: `#2d6a9a` (primary brand color), light: `#4084b8`
  - `drossgray`: `#f0f2f2` (background), dark: `#626262`
- **Font**: Inter via `next/font/google` (`src/lib/fonts.ts` - self-hosted/inlined, `--font-sans` variable, `preload: false` to keep the woff2 off the critical path, **`display: "optional"`** - NOT "swap": without a preload the woff2 arrives seconds after first paint and the late swap re-wrapped wrap-heavy lines, measured 2026-07-12 as the dominant live CLS source (0.36 on the EDDF detail page). With `optional`, cold-cache visits keep next/font's metric-adjusted fallback with zero late reflow; repeat visits render Inter from cache); Tahoma, Verdana as fallback stack
- **CSS delivery**: `experimental.inlineCss: true` in `next.config.mjs` - each page's CSS is inlined as a `<style>` in `<head>` instead of external stylesheet links. Removes the render-blocking CSS round trip AND structurally eliminates "resource was preloaded but not used" console warnings from route prefetching (there is no external CSS file to preload). ~10 KiB gzipped per document is fine now that heavy data (map markers) is no longer serialised into SSR - keep it enabled.
- **shadcn/ui**: new-york style (only `input` + `skeleton` remain; NO Radix dependencies are left in the project), Lucide icons (`lucide-react` pinned to `^1.21.0` - verify icon names by import before using)
- **CSS Variables**: Used for shadcn theme tokens (background, foreground, etc.)
- **Dark mode**: class-based (configured but not actively used)
- **Browserslist** (`package.json` `browserslist`): pinned to modern evergreen targets (`chrome >= 93`, `edge >= 93`, `firefox >= 92`, `safari >= 15.4`, `ios_saf >= 15.4`). Without an explicit list, Next/SWC/Lighthouse fall back to a wide default that ships legacy transpilation + polyfills; the pin keeps the JS output lean (no needless `Array.prototype` / spread polyfills) for the browsers our aviation audience actually uses. Bump the floor only with a concrete reason.

## Environment Variables

### Server-side (required)

| Variable                   | Description                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRON_SECRET                | Bearer token for API auth (Worker secret)                                                                                                                                                                                                                                                  |
| ADSENSE_ID                 | Google AdSense publisher ID                                                                                                                                                                                                                                                                |
| OPENAIP_API_KEY (optional) | OpenAIP core API key for the embedded aerodrome-facts card (`x-openaip-api-key`); unset = OurAirports + AWC (NOAA) only. Without it the card still fills coordinates / elevation / runways / frequencies from AWC (free, no key), but loses fuel / PPR / opening hours / circuit direction |
| PUBLIC_API_KEY (optional)  | Shared Bearer token for the public read-only data API (`/api/v1/*`, `src/lib/api-auth.ts`), issued to integration partners. **Unset = the API returns 503** (inert / not provisioned), so shipping the routes exposes nothing until a key is set with `wrangler secret put PUBLIC_API_KEY`                       |

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
- **Hosting**: self-hosted GitHub Actions runner (on the Coolify/netcup box), scheduled by `.github/workflows/crawl.yml` (daily crawl+publish) and `facts-import.yml` (weekly OurAirports import); both `workflow_dispatch`-triggerable. Fresh checkout per run, so no host-side `git pull` drift. The crawlers are **never** deployed to Workers/Vercel; treat the website and the crawlers as two independent deploy targets that communicate only over HTTP.
- **Dependencies**: `httpx`, `bs4`, `pydantic`, `pydantic-settings` (the path all active crawlers use); `playwright` (JS-rendering fallback, DK only - browser installed separately with `uv run playwright install chromium`). No Selenium: the migration to httpx is complete and the `selenium` / `webdriver-manager` deps were removed.
- **Base classes** (all crawlers are httpx-based, DK via Playwright; no Selenium):
  - **`crawlers/crawlers/http_base.py` → `HttpCrawlerBase`** - preferred. Wraps an `httpx.Client` (pooled, redirects, sane UA), exposes `fetch()`, `soup()`, `get_frame_src()`, `follow_frame_chain()`, `clean_text()`, and `save_response()` for post-mortem debugging. Also `use_browser_headers()` (WAF'd sources) and `use_proxy()` (Bright Data proxy / Web Unlocker zone). `fetch()` is HTML-only: it refuses image/binary URLs and content types (keeps metered-proxy traffic minimal). No browser.
  - **`crawlers/crawlers/http_eurocontrol_base.py` → `HttpEurocontrolBase`** - extends `HttpCrawlerBase` with `extract_airports_from_html()`, the BS4 parser for the eurocontrol-style eAIP navigation HTML (NL, UK, FR all share it).
  - **`crawlers/crawlers/playwright_base.py` → `PlaywrightCrawlerBase`** - extends `HttpCrawlerBase` with `render_html(url)`, a headless-Chromium (Playwright) render for **client-rendered JS** sources (DK/Naviair; future JS-viewer AIPs). The one allowed browser fallback - runs ONLY on the netcup host / self-hosted runner, **never** on the Worker. `playwright` is imported lazily inside `render_html`, so importing a crawler never needs the browser; a missing/unlaunchable browser raises `PlaywrightUnavailable`, which crawlers catch to fail soft (0 airports, no crash). The BS4 helpers apply to the rendered DOM.
- **Output**: Posts crawled airports to the Next.js API via `OutputHandler`
- **Crawler env vars**: `API_ENDPOINT`, `API_KEY`, `LOG_LEVEL`, `LOG_FILE`. Optional Bright Data zones for blocked sources: `BRIGHTDATA_PROXY_URL` (plain proxy - clears IP blocks), `BRIGHTDATA_UNLOCKER_URL` (Web Unlocker - solves captchas + JS; GR prefers this over the plain proxy). Both are used through `use_proxy()`; credentials are never logged or committed.

When adding a new country crawler, inherit from `HttpCrawlerBase` (or `HttpEurocontrolBase` if the source is a eurocontrol eAIP). For a **client-rendered JS** source with no server-side HTML, inherit from `PlaywrightCrawlerBase` and render with `render_html()` (DK is the reference). For a **server-side captcha** gate (GR/HASP), route through the Bright Data Web Unlocker zone (`BRIGHTDATA_UNLOCKER_URL`) - Playwright alone cannot solve it. **Do not** introduce Puppeteer (Node-only) or run any browser inside a Worker/Vercel function - the browser lives with the crawlers on the self-hosted runner.

## Deployment

### Cloudflare Workers (current)

- Deploy with `pnpm deploy` (runs `opennextjs-cloudflare build` then `deploy`). Local end-to-end preview with `pnpm preview` (miniflare + local D1/R2).
- One-time resource setup: `wrangler d1 create aip-aero`, `wrangler d1 create aip-aero-tag-cache`, `wrangler r2 bucket create aip-aero-inc-cache` (R2 must be enabled on the account first), then paste the returned D1 IDs into `wrangler.jsonc`. Set the secret with `wrangler secret put CRON_SECRET` (and `ADSENSE_ID`).
- **CD:** `.github/workflows/cd.yml` (self-hosted) deploys on push to `main`: applies D1 migrations, `cf-build`, **excludes the DB-seeded lists+sitemaps from the cache seed** (see below), `opennextjs-cloudflare deploy`, then a self-healing **"Refresh + verify prerendered lists"** step. Auth via `CLOUDFLARE_API_TOKEN` (needs edit on Workers Scripts, R2 Storage, D1, and Workers Routes) and `CLOUDFLARE_ACCOUNT_ID` repo secrets.
- **The deploy no longer re-seeds the airport lists EMPTY** (fixed 14.07.2026). Root cause: `opennextjs-cloudflare deploy` runs `populateCache` first, which PUTs the build's empty prerenders (the build has no DB) into R2 **unconditionally**, overwriting the live filled entries - the ~4 min empty window after every deploy. There is no partial-skip flag, and a full skip (`wrangler deploy`) would break code updates to the fully-static pages (homepage, `/llms.txt`, `/terms`, `/efb`; they carry no revalidate tag → would serve OLD HTML forever). The fix is **surgical**: a CD step between `cf-build` and deploy DELETES exactly the DB-dependent cache assets from the build output - `find .open-next/cache -name 'airport-list.cache' -delete` and the `2d6a9a/sitemap/*.xml.cache` files - so `populateCache` skips them, their filled R2 entries survive the deploy, and the post-deploy `POST /api/revalidate` (busts the `country:<CC>` tags) regenerates them from the live D1 with the new code (stale-while-revalidate serves the FILLED copy while regenerating - never empty). Everything else stays in the seed (static pages refresh normally; the sitemap INDEX `2d6a9a/index.xml` is not DB-dependent and stays). The **"Refresh + verify"** loop remains as a safety net: it busts the tags + warms the list URLs, then counts the heaviest list's per-row `use href="#row-link-icon"` markers (full render = hundreds) and retries if somehow zero - it should pass round 1 now. A second **Cloudflare Workers-Builds Git integration** also deploys on push (dashboard, not the repo) but uses plain `wrangler deploy` (no populate → does NOT seed empty), so it is harmless to the cache; disconnecting it is optional cleanup (removes redundant + preview builds). **Migration hazard (15.07.2026):** this Git integration deploys **branch** pushes straight to production and does **NOT apply D1 migrations** (only `cd.yml` on push-to-`main` runs `wrangler d1 migrations apply DB --remote`). So a PR that adds a migration and a code read of the new column will, on the branch push, run new code against the OLD remote schema → the read throws (`cachedRead` re-throws at runtime) and can 500 the affected pages on cache regeneration, plus the next crawler POST's insert of the new column fails. Mitigation for any migration-bearing change: apply the migration to remote D1 **manually before/at branch-push time** (`ALTER TABLE …` via the D1 API/console) AND record it in the `d1_migrations` table (`INSERT INTO d1_migrations (name, applied_at) VALUES ('<NNNN_name>.sql', datetime('now'))`) so the merge-CD's `migrations apply` skips it (no duplicate-column error). Done exactly this for `0007_*` (the `crawl_meta.airac` column). The clean long-term fix is disconnecting this Git integration so only `cd.yml` (migrate → build → deploy → revalidate) deploys.
- Apply DB schema: `wrangler d1 migrations apply DB --local` (preview) / `--remote` (prod).
- The GH Actions CI runs the OpenNext build (`pnpm cf-build`) - no DB needed. Cutover is preview-first: validate on a `workers.dev`/preview URL (site + crawler POST), then repoint `aip.aero` DNS.

### Docker (legacy)

- Multi-stage `Dockerfile` (deps → build → runner), `docker-compose.yml` exposing `127.0.0.1:8080:3000`.
- `next.config.mjs` sets `output: "standalone"` for this image.
- Runs `db:push` during the Docker build.
- Kept for local container testing only; the netcup host no longer serves the website.

## Conventions

- **Never use em-dashes (`—`) anywhere** - not in user-facing content/translations (`messages/*.json`), docs (`*.md`), code comments, or copy. Use a spaced hyphen (`-`), a comma, or parentheses instead. This is a hard style rule for the project. (Exception: a literal `"—"` used as functional parsing data in code, e.g. `str.replace("—", "")` in the crawler base, is not prose and must be left as-is.)
- **Every airport detail page MUST show the AIRAC cycle** (hard rule, owner directive 16.07.2026). The AIRAC/edition date resolves from the field's chart/page URL (`airacDateFromUrl` in `src/lib/charts.ts`, one regex per source format) and, when the URL carries no date, falls back to the country's stamped edition (`crawl_meta.airac` via `QUERIES.crawlAirac`). The chart-PDF box and the boxless "AIRAC …" line BOTH use that fallback (`airport-gadgets.tsx` / `airport-chart.tsx`). So a **new country must** either (a) publish chart URLs that embed the edition date and add a matching `AIRAC_PATTERNS` entry (RO `/2026-07-09/`, GR `_wef_09jul2026`), OR (b) forward the edition to `crawl_meta.airac` by setting `self.airac` in the crawler (the DE/MK pattern - MK's `current` alias is date-less, so `mk.py` reads the edition from `top.htm`). CZ is the only known field with no date anywhere.
- **Aerodrome titles are ALWAYS `<name> <ICAO>`** (hard rule, owner directive 16.07.2026). Every crawler's `Airport.title` must be the human place name followed by the ICAO code - e.g. `"Bad Ragaz Airfield LSMP"`, `"Skopje LWSK"`, `"Bucuresti / Henri Coanda LROP"` - because that one string drives the airport-list, the **map marker popup label** and the detail-page heading. The `HttpEurocontrolBase` parsers already build `f"{title_rest} {icao}"`; a **new non-eurocontrol crawler must do the same** (`title = f"{name} {icao}"`) and NOT emit the bare name (the CH/OurAirports bug: it shipped `"Bad Ragaz Airfield"` with no ICAO) NOR the bare ICAO with no name (the GR AD-2 gap: `title = icao`). Only fields that genuinely have **no ICAO** in the source (icao=None: small VFR strips, name-only island helipads) may be name-only. Assert `title.endswith(icao)` for ICAO-bearing fields in the crawler's unit test.
- **Every link/hyperlink MUST carry an SEO-optimized `title` attribute** (hard rule, owner directive 16.07.2026). ANY clickable anchor - inline body links, nav/menu links, CTA buttons, footer links, self-anchoring section headings (`SectionHeading` `linkTitle`), accordion summaries, breadcrumb crumbs - must have a descriptive, localized `title`. Prefer a dedicated i18n `*.hrefTitle` / `linkTitle` key; where a per-link key would be excessive, compose one from existing localized strings (the `country-faq.tsx` / terms-page pattern, e.g. `` `${t("title")} - ${t("sectionTitle")}` ``). Never ship a bare `<a>`/`<Link>` with no `title`. (Purely decorative/`aria-hidden` markers and the language-toggle `<a>` that already carries `hreflang` + `aria-current` are the only exceptions.)
- Prefer editing existing files over creating new ones; do not add new top-level docs unless asked.
- Keep components colocated under `src/components`; primitives go in `src/components/ui`.
- Server-only logic belongs under `src/server` (`"use server"` actions, DB access, secrets).
- For new translated strings, update **all** locale files in `messages/` (including `*-EN` variants) so builds don't break.
- Use `pnpm` - never `npm` or `yarn` (lockfile is `pnpm-lock.yaml`).
- Don't introduce Node-specific runtime APIs in code that may run on Vercel's edge runtime (`middleware.ts`).
- **Accordion convention (owner directive 13.07.2026)** - EVERY collapsible/accordion section must: (1) be a native `<details>/<summary>` (no JS accordion libs; SSR-collapsed = no CLS; the content stays in the crawlable HTML - Google fully indexes collapsed `<details>` content); (2) give each item an `id` slugified from its localized headline (reuse `slugify` from `section-heading.tsx`) and a `title` attribute on the `<summary>` - NEVER a link inside the summary (axe `nested-interactive`: summary is itself a control); the section heading uses `SectionHeading` with `linkTitle`; (3) bind hash <-> accordion two-way via the shared `HashDetailsOpener` island, mounted once per page: an inbound `#<id>` opens the item (CSS `:target` cannot expand a `details`), and OPENING an item writes its id into the URL hash (replaceState) so the URL is always a shareable deep link - the island is the accordion's ONLY client JS; (4) carry internal links in the body copy where sensible (internal linking density), always with a permanent underline (axe `link-in-text-block`: color alone fails against gray body copy); (5) emit any matching JSON-LD (e.g. FAQPage) from the SAME strings as the visible copy - never markup-only. Reference implementations: `country-faq.tsx` and the homepage FAQ in `src/app/page.tsx`.

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
- Locale pages lose their meta description / OG tags if `setRequestLocale(locale)` runs _after_ `getMessages()`/`getTranslations()` - it forces dynamic rendering and OpenNext/Workers then serves the page without prerendered `<head>` metadata (see SEO section).
- Locale `uk` means United Kingdom (not Ukrainian) - it's the default locale
- The `slug` field is auto-generated: uses ICAO code if available, otherwise slugified title
- The `searchAirports` server action only supports types `vfr`, `ifr`, `heliport` (not `mil` or `aeroport`)
- **`<main>` in `[locale]/layout.tsx` carries `min-h-screen` - the footer must START below the initial viewport on every page.** The dynamic search/detail routes stream the page into the layout shell, and their loading state is far shorter than the real content: without the reserve, a slow stream painted header + skeleton + footer (in-viewport), and the arriving content pushed the footer ~1500px down - a single ~0.36 CLS event (the live EDDF/LFPG outliers, root-caused 12.07.2026 with a local PerformanceObserver repro). Do not remove the class, and keep any new route's loading state in mind: it may be short, the viewport reserve is what protects CLS.
- **Cloudflare "Error 1102 - Worker exceeded resource limits" has TWO variants - always diagnose via the `outcome` field in the observability logs, never from the error number alone.** (a) **Memory** (128 MB, not configurable): every early occurrence traced to loading a **whole country's dataset into a single render** - first the airport-list map markers (fixed: client-fetched from `/api/airport-coords`), then the "nearby airfields" box (fixed: bounded `QUERIES.airportsNear` box query). Never introduce another full-country in-memory load on a request path; the agreed next escalation if the memory variant recurs is moving the nearby box fully client-side. (b) **CPU** (`outcome: "exceededCpu"`, observed 10.07.2026): the Workers **Free plan** limits CPU to 10 ms/request - our SSR pages need 200-1000 ms and only survived on burst tolerance, so concurrent load (e.g. a browser prefetching several dynamic routes at once) got requests killed. Fix = **Workers Paid plan** (30 s/request); no code change can fully avoid this on Free - **the account moved to the Paid plan on 13.07.2026**, so this variant should be history. Known trigger (13.07.2026, 1,492-error storm, still on Free): a single **PWA country-pack bulk download** - ~800 dynamic detail renders exhausted the burst budget even at concurrency 3 and 503'd dynamic routes sitewide. `save-country-offline-button.tsx` keeps cooperative throttling as a safety net (CONCURRENCY 3 + 100 ms inter-page delay + 8 s backoff on 5xx + give-up after 10 consecutive failures); if the account ever drops back to Free, set CONCURRENCY to 1.
- **Header navigation is server-rendered; the mobile menu is a horizontally scrollable PILL BAR below the sticky header row (the hamburger + dialog and, before that, the vaul drawer were removed).** `menu.tsx` / `mobile-menu.tsx` are server components - labels resolve at render time, so NO Menu messages ship to the client. The only client island is `nav-link.tsx` (active state as `aria-current="page"` via `usePathname`; style it with the `aria-[current=page]:` variant). The mobile nav links are always-visible SSR HTML in the document flow - do not hide them behind a hamburger/portal again (mobile-first indexing must see the `<nav>`, and a chip bar is one tap fewer). The bar deliberately sits OUTSIDE the sticky `<header>` element and scrolls away with the page (sticky would permanently cost ~50px of mobile viewport); countries have 3-6 entries, overflow scrolls horizontally with the scrollbar hidden. Nav entries live once in `src/lib/nav-items.ts` (shared by both menus). next-intl's client `Link`/`usePathname`/`useLocale` throw without a `NextIntlClientProvider` ancestor - the header carries exactly ONE provider with an explicitly EMPTY `messages={{}}` (all labels are server-resolved props; omitting the prop would make next-intl v4 inherit and serialize ALL messages) around Menu + LocaleSwitcher + MobileNav; a provider adds no DOM node, so the header flex row is unaffected. The language switcher is `locale-switcher-links.tsx`: two plain `<a>` links (crawlable, `rel="alternate" hreflang`, full navigation so `<html lang>` is correct server-side, aria-current on the active language, name collapses to the flag below sm) - the former Radix Select dropdown (and `@radix-ui/react-select`) was removed; do not reintroduce a JS dropdown for a two-option toggle. `backdrop-blur` on the sticky header is lg-only (continuous compositing cost while scrolling on low-end mobiles); pills and language links are `min-h-10` tap targets. The `Menu.label` i18n key exists in every locale and doubles as the localized `aria-label` of BOTH nav landmarks (desktop + pill bar - only one is visible per breakpoint); the header logo link carries the localized, keyword-rich `Common.homeLink` title.
- **The breadcrumb bar is SERVER-RENDERED BY THE PAGES (`~/components/breadcrumbs.tsx`), not the layout - visible trail and BreadcrumbList JSON-LD come from ONE data structure.** Only the pages know their hierarchy level and (on detail routes) the real airport row, so the last crumb shows the ICAO code (or the real title for non-ICAO fields) - exactly the schema's item name, guaranteed consistent. The links are plain `<a>` in every served document (the former layout-level client component never appeared in the prerendered HTML of static pages - `useSearchParams` bailed to the empty Suspense fallback). It stays at the BOTTOM of the page above the footer (owner decision: no above-the-fold cost); each page renders `<BreadCrumbs locale page? airport? />` as its last element, and the layout's old height-reserve div is gone. The bar never wraps: long trails scroll horizontally (hidden scrollbar, `mx-auto w-max` centers short trails). `<nav>` label = localized `BreadCrumbs.label`; current crumb = plain `<span aria-current="page">` (WAI-ARIA APG). Zero client JS; `ui/breadcrumb.tsx` and `@radix-ui/react-slot` (the last Radix dependency) were removed.
- New crawlers must inherit from `HttpCrawlerBase` (or `HttpEurocontrolBase` for eurocontrol eAIPs); use `PlaywrightCrawlerBase` only for genuinely client-rendered JS sources (DK). Never spin up a browser in `__init__` - it makes the crawler impossible to import in browserless environments (CI runners); Playwright is imported lazily inside `render_html`.
- **Chart-PDF extraction (Stage 2) runs in the crawlers**: `attach_pdf_urls()` in `http_base.py`, opt-in per crawler via `FETCH_PDF_URLS` + `PDF_TEXT_PRIORITY`/`PDF_HREF_PRIORITY` regexes (per-country patterns from the live-test `pdf_recon` runs, see `docs/chart-pdf-plan.md`). It also stores the source's FULL chart list per airport (`airports.charts`, JSON `{name,url}[]` capped at 50): the chart box shows the primary link plus a collapsed all-charts list, an honest designation + AIRAC-date line (`src/lib/charts.ts`, unit-tested), and DigitalDocument JSON-LD with `datePublished`/`hasPart`. The publish path logs per-country `pdf_url coverage` and warns (Actions annotation) when a country's coverage collapses to 0 - markup drift, not a reason to block the publish. **Coverage audit 14.07.2026 (live): every live country is complete relative to what its source publishes** - 100% on CZ/DK/NO/PL/SE/EE/LV/PT/SI/HU/UK/FR/NL/AT/ES (ES 50/51), and the two low-percentage countries are correct-by-source not extraction gaps: **BE 22/167** (skeyes charts only its public aerodromes; the private/ULM/personal fields + heliports have no charts) and **IS 7/53** (Isavia charts only the major aerodromes; the gravel landing sites carry only a text AD entry). DE has NO public chart PDFs (BasicVFR is HTML-only) - never "fix" DE by pointing pdf_url at an edition-specific URL. **FI is a special case**: Fintraffic's AD 2.24 chart nodes are NOT in the airport's menu `details_div` (so the base's charts-link match cannot reach them), and the per-airport AD 2 sub-page the base picks is the waypoints section (`15-en-GB`, only `WPT_LIST`/`FAS_DB` data PDFs). `fi.py` rewrites each `url` to the full-aerodrome document page (`1-fi-FI`, consistent across all airfields), which links every real chart under `documents/Root_WePub/ANSFI/Charts/AD/<ICAO>/`; `PDF_HREF_PRIORITY` prefers `_VAC` then `_ADC`. Validation loop: `crawler-live-test.yml` (`pdf_recon` input for markup reconnaissance, `check_urls` for external URL verification from the runner - the sandboxed agent environment has no egress; the run prints per-country `pdf_url coverage`).
- The DE crawler (`de.py`) enters DFS BasicVFR/BasicIFR at static section index pages (`…/pages/CNNNNN.html`) and stores each airport's amendment-stable `myPermalink` (`const myPermalink = "pages/CNNNNN.html"`) rather than the physical, edition-specific URL (`…/<AIRAC>/chapter/<hash>.html`) that DFS renames every AIRAC cycle - so saved links survive amendments. The VFR folder-link hrefs are already those permalinks, so no per-airfield fetch is needed (only an edition-specific href triggers a leaf fetch to read `myPermalink`).
