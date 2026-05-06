# CLAUDE.md - AIP:Aero Project Knowledge Base

## Project Overview

**AIP:Aero** (https://aip.aero) is a website that simplifies the search for Aeronautical Information Publications (AIPs), approach charts, and airport data for VFR, IFR, heliports, military aerodromes, and French aeroports across multiple European countries.

- **Author**: Alexander Dross
- **Stack**: T3 Stack (Next.js + Drizzle ORM + Tailwind CSS), bootstrapped with `create-t3-app` v7.38.1
- **Package Manager**: pnpm (v10.8.1)
- **Node**: 21 (Docker uses node:21-alpine)

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
```

## Architecture

```
Crawlers (Python/Selenium) --> POST /api/airports --> Next.js API --> MySQL DB
Website (Next.js SSR/SSG) --> Server Queries --> Cache ("use cache") --> MySQL DB
```

### Data Flow
1. **Python crawlers** scrape AIP websites for airport data (using Selenium headless Chrome)
2. Crawlers POST airport data to `/api/airports` (authenticated via `CRON_SECRET` Bearer token)
3. The API validates with Zod, enriches with slugs, deletes existing country data, inserts new data
4. Cache is invalidated via `revalidateTag()` on insert
5. Website pages query the DB with Next.js `"use cache"` directive (hours lifetime)

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
│   │   ├── crawler_base.py        # Base class (Selenium WebDriver setup)
│   │   ├── eurocontrol_base.py    # Base for Eurocontrol-style eAIP sites
│   │   ├── de.py                  # Germany (DFS VFR + IFR)
│   │   ├── uk.py                  # United Kingdom (NATS eAIP)
│   │   ├── fr.py                  # France (SIA eAIP)
│   │   ├── at.py                  # Austria
│   │   ├── nl.py                  # Netherlands
│   │   └── ...                    # Other country crawlers
│   ├── pyproject.toml             # Python dependencies (uv)
│   └── tasks/                     # Planned crawler task specs
├── public/                        # Static assets
│   ├── logo.webp                  # Site logo
│   ├── robots.txt
│   ├── ads.txt
│   └── aip-logo-*.jpg             # OG images
└── Configuration files
    ├── next.config.mjs            # standalone output, trailingSlash, useCache
    ├── tailwind.config.ts         # Custom colors (drossblue, drossgray)
    ├── tsconfig.json              # Strict mode, path alias ~/
    ├── drizzle.config.ts          # MySQL dialect, aip-aero_* table filter
    ├── components.json            # shadcn/ui config (new-york, lucide)
    ├── .eslintrc.mjs              # TypeScript ESLint + Drizzle rules
    ├── prettier.config.js         # Prettier + Tailwind plugin
    ├── Dockerfile                 # Multi-stage build (deps, build, runner)
    └── docker-compose.yml         # Single service, port 8080:3000
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

| Country       | Code | Crawler Class    | Base           | AIP Source                     |
|---------------|------|------------------|----------------|--------------------------------|
| United Kingdom| UK   | `UK`             | EurocontrolBase| NATS eAIP                     |
| Germany       | DE   | `DE`             | CrawlerBase    | DFS BasicVFR/BasicIFR          |
| France        | FR   | `FR`             | EurocontrolBase| SIA eAIP                      |
| Netherlands   | NL   | `NL`             | EurocontrolBase| LVNL eAIP                     |
| Austria       | AT   | `AT`             | EurocontrolBase| Austro Control eAIP           |

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
- Skip validation with `SKIP_ENV_VALIDATION=true` (useful for Docker builds)

## Crawlers (Python Subsystem)

- Located in `/crawlers/`
- **Runtime**: Python 3.12+ with `uv` package manager
- **Dependencies**: selenium, webdriver-manager, bs4, pydantic, pydantic-settings
- **Base classes**:
  - `CrawlerBase`: Headless Chrome setup, screenshot/page-source saving, text cleaning
  - `EurocontrolBase(CrawlerBase)`: Shared logic for Eurocontrol-style eAIP sites (AT, FR, NL, UK)
- **Output**: Posts crawled airports to the Next.js API via `OutputHandler`
- **Scheduling**: Systemd timer (`aip-crawler.service` + `aip-crawler.timer`)
- **Crawler env vars**: `API_ENDPOINT`, `API_KEY`, `LOG_LEVEL`, `LOG_FILE`

## Deployment

- **Docker**: Multi-stage Dockerfile (deps -> build -> runner)
- **docker-compose**: Single service on port 8080:3000
- **Next.js output**: `standalone` mode
- **Logging**: Axiom via `next-axiom`
- **DB migrations**: Run `db:push` during Docker build

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
