# Functionality Test

Verifies that each user- and machine-facing behaviour of the website, the
backend API, and the crawlers actually works - not just that the code compiles.
Anchored in real, repeatable output (Playwright E2E, Vitest, pytest, a production
build). Human-only checks live in [`uat.md`](./uat.md).

_Last executed: 2026-07-11 (from a clean checkout of `main`)._

## Result summary (2026-07-11)

| Surface | Test | Command | Result |
| - | --- | --- | --- |
| Website | Production build | `SKIP_ENV_VALIDATION=1 pnpm build` | ✅ built |
| Website | E2E (SEO, a11y, JSON-LD, flows, sitemap) | `pnpm test:e2e` (Playwright/Chromium) | ✅ **94 passed** |
| Website | Component/lib unit | `pnpm test` (Vitest) | ✅ **27 passed** (6 files) |
| Website | Typecheck / lint / format / i18n | `pnpm typecheck` · `lint` · `format:check` · `check-i18n` | ✅ (lint: 0 errors, 5 pre-existing warnings) |
| Crawlers | Unit | `uv run pytest tests/` | ✅ **114 passed** (11 files) |
| Crawlers | Import smoke (all 12) | ci.yml inline import test | ✅ 12/12 import + instantiate |
| Crawlers | Live dry run (no publish) | `crawler-live-test.yml` on the runner | see [`dry-run.md`](./dry-run.md) |

## A - Website E2E (black-box, `e2e/`)

`pnpm test:e2e` builds nothing itself - it runs Playwright against a
`pnpm start` production server (see `playwright.config.ts` `webServer`) with the
DB absent, so airport-row-dependent paths fail soft (the `DB read '...' failed at
runtime` lines in the server log are expected and are what the fail-soft design
guards). The page matrix in `e2e/pages.ts` mirrors `src/i18n/routing.ts`.

Specs (all green, 94 tests):

- `seo.spec.ts` - meta description present in `<head>` and unique per page,
  `<link rel=canonical>`, Open Graph / Twitter, `<html lang>`, single `<main>`.
- `a11y.spec.ts` - axe-core accessibility scan per page (no violations).
- `structured-data.spec.ts` - every `application/ld+json` block is valid JSON and
  well-typed (BreadcrumbList / Product / WebSite / SiteNavigationElement / …),
  emitted exactly once (the Workers dynamic-render dedup guard).
- `flows.spec.ts` - user flows: search, locale switch, 404.
- `sitemap.spec.ts` - sitemap index + per-country `<urlset>` structure.

> The airport-row happy paths (`?ICAO` detail metadata, sitemap airport entries)
> need a populated D1 and are covered by the deployed Lighthouse run, not here.

## B - Website unit (`pnpm test`, Vitest)

27 tests across the pure-logic seams that would silently mis-render if broken:
`crosswind.ts` (runway wind trig), `metar-decode.ts` (METAR/TAF token decode),
`openaip-parse.ts` (OpenAIP schema mapping), `utils.ts`, plus the `box` and
`external-link` components.

## C - Backend API functionality

Server-rendered/edge routes exercised by the E2E run and by the API contracts in
[`uat.md`](./uat.md) section E. Functional contracts:

- `POST /api/airports` - Bearer `CRON_SECRET` (401 without), Zod/drizzle-zod
  validation (400 on bad body), atomic per-country delete+insert via a D1
  `batch`, then `revalidateTag("country:<CC>")`.
- `searchAirports` server action - validates search (1-50) / country (2) / type,
  returns ≤ 5 matches; supports `vfr`/`ifr`/`heliport` only.
- `GET /api/airport-coords` (map markers, locale-keyed, 1h cache, fail-soft `[]`),
  `GET /api/airport-weather` (METAR/TAF, edge-cached, fail-soft empty),
  `POST /api/airport-facts` (OurAirports import, Bearer auth),
  `POST /api/revalidate` (Bearer auth, busts all country tags).

The 401/400/200 auth+validation matrix is a manual curl checklist in `uat.md` E
(needs the live Worker + `CRON_SECRET`).

## D - Crawler functionality

- **Unit** (`pytest`, 114): the pure seams - `HttpCrawlerBase` fetch/frame-chain
  helpers, the eAIP menu parser, per-country edition/URL resolvers (AT table, DE
  folder-link + `myPermalink`, FR AIRAC-path index, NL/UK edition selectors), the
  Playwright base's lazy-import + fail-soft, GR Bright Data zone selection, and
  `main.py` country selection. Network mocked with `httpx.MockTransport`.
- **Live dry run** - the only way to exercise the real navigation/parse against
  the live AIP sources; run on the self-hosted runner, no publish. See
  [`dry-run.md`](./dry-run.md).

## How to re-run (clean checkout)

```bash
# Website
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check && node scripts/check-i18n.mjs
pnpm test                                          # Vitest unit
SKIP_ENV_VALIDATION=1 pnpm build                   # production build
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm test:e2e   # Playwright E2E

# Crawlers
cd crawlers && uv sync --frozen && uv run pytest tests/
```

CI runs the same on every PR (the **E2E & rendered output** and **Website /
Crawlers** jobs in `.github/workflows/ci.yml`).

## Known non-blocking observations (2026-07-11)

- Lint: 5 pre-existing warnings (0 errors), e.g. a `react-hooks/exhaustive-deps`
  in `search-input-field.tsx`. Not regressions.
- E2E server log shows `DB read '...' failed at runtime` - expected fail-soft in
  the DB-less local run, not a functional failure.
