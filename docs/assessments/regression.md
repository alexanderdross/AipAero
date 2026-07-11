# Regression Test Strategy

## Honest framing

"Regression test" is most meaningful when there's a prior test suite to regress against. This repo had **none** until this assessment landed. So this document is half-strategy ("what gates regressions going forward") and half-snapshot ("what's currently green, locked").

## Current regression surface - what is gated on every PR

The CI workflow at `.github/workflows/ci.yml` is the regression baseline. Every PR to `main` and every push to `main` runs:

### Website (Next.js)

| Step | Catches |
| --- | --- |
| `pnpm install --frozen-lockfile` | Dep drift (lockfile out of sync with `package.json`). |
| `pnpm typecheck` (`tsc --noEmit`) | Type regressions across all Next.js routes, server actions, Drizzle types, next-intl APIs. |
| `pnpm format:check` | Prettier drift. |
| `pnpm lint` (`eslint .`, flat config) | TypeScript-aware lint rules: `no-misused-promises`, `consistent-type-imports`, drizzle's `enforce-update-with-where`. |
| `node scripts/check-i18n.mjs` | i18n parity - a locale file missing a key added to another. |
| `pnpm test` (Vitest, 27 tests) | Regressions in the pure helpers + leaf components (crosswind trig, METAR decode, OpenAIP mapper, `utils`). |
| `pnpm audit --audit-level=high --prod` | New high+ production advisories. |
| `pnpm cf-build` (OpenNext / Cloudflare Workers) | Build-time regressions (missing env vars, broken sitemap pre-render, prerendering errors). Needs no DB - build-time D1 reads fail-soft to empty and revalidate at runtime. |

### E2E & rendered output (Playwright) - separate job

| Step | Catches |
| --- | --- |
| `pnpm test:e2e` (Chromium, against `next start`) | The rendered-output SEO contract (meta description in `<head>` & unique, canonical/OG/Twitter, `<main>`, `<html lang>`), axe accessibility, JSON-LD validity, user flows (search, locale switch, 404), and sitemap structure. |

### Lighthouse budgets (local) - separate job

| Step | Catches |
| --- | --- |
| `treosh/lighthouse-ci-action` against `pnpm start` | SEO + a11y budget regressions (gating), best-practices + performance (warn), per `.lighthouserc.cjs`. |

### Crawlers (Python) - 10-15s

| Step | Catches |
| --- | --- |
| `uv lock --check` | `pyproject.toml` ↔ `uv.lock` drift. |
| `uv sync --frozen` | Dep install regression. |
| `python -m compileall` | Syntax errors in any crawler / glue file. |
| Import smoke test for AT/DE/FR/NL/UK | Catches anything that breaks `__init__` (e.g. accidentally re-introducing the Selenium parent for an HTTP crawler). |
| `pytest tests/` (114 tests) | Behavioural regressions in `HttpCrawlerBase` / `PlaywrightCrawlerBase` helpers, the eAIP parser, the AT table parser, the DE folder-link/permalink parser, the DK Playwright parse, the GR zone selection, and the FR/NL/UK edition resolvers. |

### Build gate (now in-CI, no separate external service)

- **OpenNext Worker build (`pnpm cf-build`)** - runs inside the `Website (Next.js)` job (see the step table above). It catches the build-time regressions the old Vercel preview build used to, but needs **no** database: DB reads go through the `DB` D1 binding, which is absent at build time, so pages/sitemaps prerender with empty results and revalidate at runtime.

The branch ruleset on `main` gates on the four CI jobs (`Website (Next.js)`, `Crawlers (Python)`, `E2E & rendered output (Playwright)`, `Lighthouse budgets (local)`) passing before merge. (The former Vercel preview-build check is retired - the website now deploys to Cloudflare Workers, and the build gate lives in the GH Actions CI job.)

## What's locked vs not locked

### Locked (catches regressions)

- ✅ TS type errors anywhere in `src/`.
- ✅ Prettier drift.
- ✅ `pnpm` lockfile drift.
- ✅ `uv` lockfile drift.
- ✅ Python syntax errors in `crawlers/`.
- ✅ Crawler base-class import shape (the AT/DE/FR/NL/UK smoke test).
- ✅ HTML parser behaviour for the eAIP menu (TAD_HP suffix, charts-related preference, last-link fallback, em-dash stripping).
- ✅ AT table parser behaviour (section-header skip, single-vs-multi-link rows, missing-href skip).
- ✅ HTTP base lifecycle (close idempotency, context manager).
- ✅ Build success in CI (OpenNext `pnpm cf-build`, no DB required).
- ✅ ESLint (flat config) - `pnpm lint` gates every PR (TS-aware rules + drizzle).
- ✅ i18n parity - `scripts/check-i18n.mjs` gates a missing/extra locale key.
- ✅ Website unit behaviour - Vitest (27 tests) gates the pure helpers + leaf components.
- ✅ End-to-end flows + rendered `<head>` - Playwright gates the SEO/a11y/JSON-LD/flow/sitemap contract.
- ✅ Lighthouse SEO + a11y budgets - gated against a local `pnpm start` server.

### Not locked (silent regression risk)

- ✅ (resolved) ESLint - migrated to flat config (`eslint.config.mjs`); `pnpm lint` now gates every PR with the TS-aware rules.
- ❌ Anything visual - no screenshot/visual regression tests.
- ⚠️ Runtime middleware behaviour - typecheck doesn't cover it directly, but the Playwright locale-switch/404 flows exercise the next-intl middleware end-to-end.
- ✅ (resolved) End-to-end flows - the Playwright job (`pnpm test:e2e`) now gates search, locale switch and 404 against a real `next start` server.
- ✅ (resolved) DE crawler - now ported off Selenium to `HttpCrawlerBase` and included in the smoke test + unit tests; it no longer imports Chromium at module load, so it is locked like the other four.
- ⚠️ Production crawler runs against live AIP sites - not in the PR gate; validated by the *Crawler live test* dry run (on the self-hosted runner, on demand or on a `crawlers/crawlers/**` change) and the daily *Crawl (publish)* schedule.
- ❌ Database schema drift - D1 migrations are applied on demand (`wrangler d1 migrations apply`), not in CI.
- ❌ Bundle size budget - no enforcement.
- ✅ (collected) Web Vitals - Cloudflare Web Analytics gathers Core Web Vitals via an edge RUM beacon (read in the Cloudflare dashboard). Not a CI gate, but the field data exists.

## Suggested gradual hardening

In order of cost / value:

### 1. Restore lint as a gate (small, high value) - ✅ DONE

ESLint has been migrated to flat config (`eslint.config.mjs`) and `pnpm lint` now runs as a gating step in the `Website (Next.js)` job. The TS-aware rules (`no-misused-promises`, `consistent-type-imports`, drizzle's `enforce-update-with-where`) gate every PR.

### 2. End-to-end smoke (medium, high value) - ✅ DONE

The `E2E & rendered output (Playwright)` job runs `pnpm test:e2e` against a `next start` server on every PR: search, locale switch and 404 flows plus the SEO/a11y/JSON-LD/sitemap contract (94 tests). Because it runs against the local production build (not live traffic) it is stable enough to be a PR gate.

### 3. Snapshot for a key page (medium, medium value)

A Vitest + RTL snapshot of `airport-list/page.tsx` rendering with mocked Drizzle data. Catches accidental layout / structured-data regressions. Worth doing the day someone adds the first behaviour bug.

### 4. Visual regression (high, low value)

`@playwright/test` with `toHaveScreenshot()` per locale + page. Useful but expensive - defer until there's a UI regression history that justifies the maintenance cost.

### 5. Crawler integration smoke (medium, medium value)

The *Crawler live test* dry run already does this on demand (Actions → *Crawler live test* → *Run workflow*, on the self-hosted runner, no publish). The remaining hardening would be to schedule it monthly and assert each country's output count is within ±10% of last month's. Not a PR gate; it's an ongoing health signal.

### 6. Drizzle schema migration test (small, medium value)

CI step that spins up a local D1 (miniflare) and runs `wrangler d1 migrations apply DB --local` to confirm the migrations apply cleanly. Currently the only place we discover migration breakage is the Cloudflare deploy (the CD workflow applies D1 migrations before deploying).

## Process - how to handle a regression when it does land in production

1. **Identify** via Axiom logs (`next-axiom`), Cloudflare Workers logs (`wrangler tail`), or the crawler run logs (GitHub → Actions → *Crawl (publish)* / *Crawler live test*).
2. **Reproduce** locally - fixtures preferred. The new pytest suite shows the pattern: synthetic HTML → parse → assert. Add a failing test before fixing.
3. **Fix + lock** - write the test first if it can be expressed as a unit test, then fix code, ensure the test passes.
4. **Land** - PR with the test included. CI now blocks anyone re-introducing the bug.

## Repeatable verification

Same commands as in CI:

```bash
# Website
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check && node scripts/check-i18n.mjs
pnpm test                               # Vitest (27)
pnpm audit --audit-level=high --prod
SKIP_ENV_VALIDATION=1 pnpm build        # production build (E2E runs against next start)
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm test:e2e   # Playwright (94)

# Crawlers
cd crawlers
uv lock --check
uv sync --frozen
uv run python -m compileall -q crawlers main.py output_handler.py settings.py
uv run pytest tests/
```

If all of these pass and the OpenNext `pnpm cf-build` succeeds, the change is regression-clean for the surface we currently gate.

---

_Last updated: 2026-07-11._
