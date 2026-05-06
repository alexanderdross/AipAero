# Regression Test Strategy

## Honest framing

"Regression test" is most meaningful when there's a prior test suite to regress against. This repo had **none** until this assessment landed. So this document is half-strategy ("what gates regressions going forward") and half-snapshot ("what's currently green, locked").

## Current regression surface — what is gated on every PR

The CI workflow at `.github/workflows/ci.yml` is the regression baseline. Every PR to `main` and every push to `main` runs:

### Website (Next.js) — 30-40s

| Step | Catches |
| --- | --- |
| `pnpm install --frozen-lockfile` | Dep drift (lockfile out of sync with `package.json`). |
| `pnpm typecheck` (`tsc --noEmit`) | Type regressions across all Next.js routes, server actions, Drizzle types, next-intl APIs. |
| `pnpm format:check` | Prettier drift. |

### Crawlers (Python) — 10-15s

| Step | Catches |
| --- | --- |
| `uv lock --check` | `pyproject.toml` ↔ `uv.lock` drift. |
| `uv sync --frozen` | Dep install regression. |
| `python -m compileall` | Syntax errors in any crawler / glue file. |
| Import smoke test for AT/FR/NL/UK | Catches anything that breaks `__init__` (e.g. accidentally re-introducing the Selenium parent for an HTTP crawler). |
| `pytest tests/` (29 tests) | Behavioural regressions in `HttpCrawlerBase` helpers, the eAIP parser, and the AT table parser. |

### External gates (also required by the `main` ruleset)

- **Vercel preview build** — runs `next build` against real DB credentials in Vercel, catches build-time regressions (missing env vars, broken sitemap pre-render, prerendering errors) that the GH Actions CI deliberately doesn't.

The branch ruleset on `main` requires all three checks (`Website (Next.js)`, `Crawlers (Python)`, `Vercel`) to pass before merge.

## What's locked vs not locked

### Locked (catches regressions)

- ✅ TS type errors anywhere in `src/`.
- ✅ Prettier drift.
- ✅ `pnpm` lockfile drift.
- ✅ `uv` lockfile drift.
- ✅ Python syntax errors in `crawlers/`.
- ✅ Crawler base-class import shape (the AT/FR/NL/UK smoke test).
- ✅ HTML parser behaviour for the eAIP menu (TAD_HP suffix, charts-related preference, last-link fallback, em-dash stripping).
- ✅ AT table parser behaviour (section-header skip, single-vs-multi-link rows, missing-href skip).
- ✅ HTTP base lifecycle (close idempotency, context manager).
- ✅ Build success at deploy time (Vercel preview).

### Not locked (silent regression risk)

- ❌ ESLint rules — `next lint` doesn't currently run because of the broken config. Means TypeScript-aware lint rules (consistent imports, no-misused-promises, drizzle/enforce-update-with-where) aren't gating.
- ❌ Anything visual — no screenshot/visual regression tests.
- ❌ Runtime middleware behaviour — typecheck doesn't cover the next-intl middleware actually rewriting paths correctly.
- ❌ End-to-end flows — no Playwright / Cypress.
- ❌ DE crawler — excluded from the smoke test because it imports Chromium at module load.
- ❌ Production crawler runs against live AIP sites — only post-deploy on netcup.
- ❌ Database schema drift — `pnpm db:push` is run on demand, not in CI.
- ❌ Bundle size budget — no enforcement.
- ❌ Web Vitals — no Speed Insights enabled yet.

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

Run as a *separate* GitHub Action triggered by a `workflow_dispatch` or daily cron, against the deployed Vercel URL. Not a PR gate (too slow, too flaky against real traffic), but a confidence loop.

### 3. Snapshot for a key page (medium, medium value)

A Vitest + RTL snapshot of `airport-list/page.tsx` rendering with mocked Drizzle data. Catches accidental layout / structured-data regressions. Worth doing the day someone adds the first behaviour bug.

### 4. Visual regression (high, low value)

`@playwright/test` with `toHaveScreenshot()` per locale + page. Useful but expensive — defer until there's a UI regression history that justifies the maintenance cost.

### 5. Crawler integration smoke (medium, medium value)

Once a month, run each `crawl()` against the live site (from the netcup host, not CI) and assert the output count is within ±10% of last month's. Not in PR gate; it's an ongoing health signal.

### 6. Drizzle schema migration test (small, medium value)

CI step that spins up MySQL via service container and runs `pnpm db:push` to confirm the schema applies cleanly. Currently the only place we discover migration breakage is on Vercel deploy.

## Process — how to handle a regression when it does land in production

1. **Identify** via Axiom logs (`next-axiom`), Vercel runtime logs, or `journalctl -u aip-crawler` on netcup.
2. **Reproduce** locally — fixtures preferred. The new pytest suite shows the pattern: synthetic HTML → parse → assert. Add a failing test before fixing.
3. **Fix + lock** — write the test first if it can be expressed as a unit test, then fix code, ensure the test passes.
4. **Land** — PR with the test included. CI now blocks anyone re-introducing the bug.

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

If all of these pass and the Vercel preview is green, the change is regression-clean for the surface we currently gate.

---

_Last updated: 2026-05-06._
