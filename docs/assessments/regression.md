# Regression Test Strategy

## Honest framing

"Regression test" is most meaningful when there's a prior test suite to regress against. This repo had **none** until this assessment landed. So this document is half-strategy ("what gates regressions going forward") and half-snapshot ("what's currently green, locked").

## Current regression surface - what is gated on every PR

The CI workflow at `.github/workflows/ci.yml` is the regression baseline. Every PR to `main` and every push to `main` runs:

### Website (Next.js) - 30-40s

| Step | Catches |
| --- | --- |
| `pnpm install --frozen-lockfile` | Dep drift (lockfile out of sync with `package.json`). |
| `pnpm typecheck` (`tsc --noEmit`) | Type regressions across all Next.js routes, server actions, Drizzle types, next-intl APIs. |
| `pnpm format:check` | Prettier drift. |
| `pnpm cf-build` (OpenNext / Cloudflare Workers) | Build-time regressions (missing env vars, broken sitemap pre-render, prerendering errors). Needs no DB - build-time D1 reads fail-soft to empty and revalidate at runtime. |

### Crawlers (Python) - 10-15s

| Step | Catches |
| --- | --- |
| `uv lock --check` | `pyproject.toml` ↔ `uv.lock` drift. |
| `uv sync --frozen` | Dep install regression. |
| `python -m compileall` | Syntax errors in any crawler / glue file. |
| Import smoke test for AT/DE/FR/NL/UK | Catches anything that breaks `__init__` (e.g. accidentally re-introducing the Selenium parent for an HTTP crawler). |
| `pytest tests/` (91 tests) | Behavioural regressions in `HttpCrawlerBase` helpers, the eAIP parser, the AT table parser, the DE folder-link/permalink parser, and the FR/NL/UK edition resolvers. |

### Build gate (now in-CI, no separate external service)

- **OpenNext Worker build (`pnpm cf-build`)** - runs inside the `Website (Next.js)` job (see the step table above). It catches the build-time regressions the old Vercel preview build used to, but needs **no** database: DB reads go through the `DB` D1 binding, which is absent at build time, so pages/sitemaps prerender with empty results and revalidate at runtime.

The branch ruleset on `main` requires both checks (`Website (Next.js)`, `Crawlers (Python)`) to pass before merge. (The former Vercel preview-build check is retired - the website now deploys to Cloudflare Workers, and the build gate lives in the GH Actions CI job.)

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

### Not locked (silent regression risk)

- ❌ ESLint rules - `next lint` doesn't currently run because of the broken config. Means TypeScript-aware lint rules (consistent imports, no-misused-promises, drizzle/enforce-update-with-where) aren't gating.
- ❌ Anything visual - no screenshot/visual regression tests.
- ❌ Runtime middleware behaviour - typecheck doesn't cover the next-intl middleware actually rewriting paths correctly.
- ❌ End-to-end flows - no Playwright / Cypress.
- ✅ (resolved) DE crawler - now ported off Selenium to `HttpCrawlerBase` and included in the smoke test + unit tests; it no longer imports Chromium at module load, so it is locked like the other four.
- ❌ Production crawler runs against live AIP sites - only post-deploy on netcup.
- ❌ Database schema drift - D1 migrations are applied on demand (`wrangler d1 migrations apply`), not in CI.
- ❌ Bundle size budget - no enforcement.
- ✅ (collected) Web Vitals - Cloudflare Web Analytics gathers Core Web Vitals via an edge RUM beacon (read in the Cloudflare dashboard). Not a CI gate, but the field data exists.

## Suggested gradual hardening

In order of cost / value:

### 1. Restore lint as a gate (small, high value)

The ESLint config is half-broken (see `best-practices.md`). Once fixed, add:

```yaml
- name: Lint
  run: pnpm lint
```

to the website job.

### 2. End-to-end smoke for one country (medium, high value)

A single Playwright test that:

- visits `https://aip.aero/`
- clicks through to a country's airport list
- searches for a known ICAO and verifies a result appears

Run as a *separate* GitHub Action triggered by a `workflow_dispatch` or daily cron, against the deployed URL. Not a PR gate (too slow, too flaky against real traffic), but a confidence loop.

### 3. Snapshot for a key page (medium, medium value)

A Vitest + RTL snapshot of `airport-list/page.tsx` rendering with mocked Drizzle data. Catches accidental layout / structured-data regressions. Worth doing the day someone adds the first behaviour bug.

### 4. Visual regression (high, low value)

`@playwright/test` with `toHaveScreenshot()` per locale + page. Useful but expensive - defer until there's a UI regression history that justifies the maintenance cost.

### 5. Crawler integration smoke (medium, medium value)

Once a month, run each `crawl()` against the live site (from the netcup host, not CI) and assert the output count is within ±10% of last month's. Not in PR gate; it's an ongoing health signal.

### 6. Drizzle schema migration test (small, medium value)

CI step that spins up a local D1 (miniflare) and runs `wrangler d1 migrations apply DB --local` to confirm the migrations apply cleanly. Currently the only place we discover migration breakage is the Cloudflare deploy (the CD workflow applies D1 migrations before deploying).

## Process - how to handle a regression when it does land in production

1. **Identify** via Axiom logs (`next-axiom`), Cloudflare Workers logs (`wrangler tail`), or `journalctl -u aip-crawler` on netcup.
2. **Reproduce** locally - fixtures preferred. The new pytest suite shows the pattern: synthetic HTML → parse → assert. Add a failing test before fixing.
3. **Fix + lock** - write the test first if it can be expressed as a unit test, then fix code, ensure the test passes.
4. **Land** - PR with the test included. CI now blocks anyone re-introducing the bug.

## Repeatable verification

Same commands as in CI:

```bash
# Website
pnpm install --frozen-lockfile
pnpm typecheck && pnpm format:check

# Crawlers
cd crawlers
uv lock --check
uv sync --frozen
uv run python -m compileall -q crawlers main.py output_handler.py settings.py
uv run pytest tests/
```

If all of these pass and the OpenNext `pnpm cf-build` succeeds, the change is regression-clean for the surface we currently gate.

---

_Last updated: 2026-05-06._
