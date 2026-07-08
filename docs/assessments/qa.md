# QA Assessment

Top-level summary across the seven assessments. Each section has a verdict and a pointer to the detailed doc.

## Methodology

This QA assessment is a roll-up: it doesn't introduce new findings of its own. It indexes the other six assessments, calls out cross-cutting themes, and ranks the consolidated action list by ROI.

## Section verdicts

| Area | Verdict | Detail |
| --- | --- | --- |
| **Unit tests** | ✅ Now in place for the crawlers (91 tests, gated in CI). Website only lightly covered (Vitest pure-helper tests), justified. | [`unit-tests.md`](./unit-tests.md) |
| **Regression** | ✅ CI gates typecheck + format + crawler unit tests + the OpenNext `pnpm cf-build` (no DB needed). Visual regression is a gap. | [`regression.md`](./regression.md) |
| **Performance** | ⚠️ Static analysis only - no live numbers yet. Three actionable bugs/gaps found. | [`performance.md`](./performance.md) |
| **Best practices** | ⚠️ Most App Router conventions followed correctly. Five concrete gaps, one is a real bug (missing `revalidateTag` calls). | [`best-practices.md`](./best-practices.md) |
| **Security** | ⚠️ Strong on auth + validation + SQL. Twenty-five transitive npm advisories (all dev-side or one-step-removed). One small input-validation tweak needed. | [`security.md`](./security.md) |
| **UAT** | ⏸ Runbook delivered. Awaiting human walk-through. | [`uat.md`](./uat.md) |

## Cross-cutting themes

### 1. The system is well-architected for its size

Single-author T3 stack project. Caching is right (per-country cache-tag invalidation on writes, `unstable_cache` on reads), separation of concerns is clean (server/`actions.ts` for `"use server"`, server/db/`queries.ts` for DB, env validation centralised), i18n correctly uses the modern `defineRouting` + `createNavigation` API. The crawlers were the worst offender (Selenium for everything) and have now been migrated to httpx for all five countries.

The split-host architecture (Cloudflare Workers for web, netcup for crawlers) is correct - repeatedly re-evaluated, repeatedly the right answer.

### 2. The two real bugs found

Both surfaced in the best-practices audit, both small fixes:

| Bug | Where | Impact |
| --- | --- | --- |
| Missing `revalidateTag` calls for `militaryAirports` and `aeroportAirports` | `src/server/db/queries.ts:MUTATIONS.insertAirports` | France pages serve stale data until the 24h cache revalidate window after each crawl. |
| `country` validation accepts empty string and 1-char inputs | `src/server/actions.ts:schema` | Currently `z.string().max(2)` - should be `z.string().length(2)` or an enum from `routing.locales`. Allows malformed search requests through. |

Both are <5-line fixes.

### 3. Three frontend / performance tooling items (mostly resolved)

- `next/image`: **resolved for the header** - `src/components/header.tsx` now renders `<Image priority>`. (The Workers runtime has the image optimizer off, so this is about sizing / `priority` / layout stability; any remaining raw assets in `public/` are the next targets.)
- Core Web Vitals: **collected via Cloudflare Web Analytics** - the edge RUM beacon is allowlisted in the `next.config.mjs` CSP, so there's no `@vercel/speed-insights` / `<SpeedInsights />`. Read CWV in the Cloudflare dashboard.
- `@next/bundle-analyzer` is not in devDependencies - no easy way to spot accidentally-shipped server deps in the client bundle.

### 4. The ESLint situation - resolved

The ESLint config has been migrated to flat config: `eslint.config.mjs` is in place, `pnpm lint` runs `eslint .` cleanly, and the `Website (Next.js)` CI job now runs `pnpm lint` as a gating step. TS-aware lint rules (`no-misused-promises`, `consistent-type-imports`, drizzle's `enforce-update-with-where`) now gate PRs. This was previously the single biggest gap in the regression gate; it is now closed.

### 5. The DE crawler Selenium debt - resolved

DE has been ported from the legacy `CrawlerBase` to `HttpCrawlerBase`: it now enters DFS BasicVFR/BasicIFR at static `.../pages/CNNNNN.html` section URLs and stores each airport's amendment-stable `myPermalink` (so saved links survive the monthly AIRAC edition rename). As a result:

- The CI import smoke test now includes DE, eliminating Chromium-on-CI as a constraint.
- DE now has unit tests (`crawlers/tests/test_de.py`).

The remaining cleanup is bounded: `crawlers/crawlers/crawler_base.py` and `eurocontrol_base.py` (Selenium) survive only because the experimental, non-scheduled crawlers (`belgium`, `car_sam_nam`, `pac_n`, `pac_p`, `run`) still import them - no active crawler does. Once those are ported or pruned, the legacy bases plus `selenium` / `webdriver-manager` (and their `trio` / `wsproto` transitive deps) can come out in one cleanup commit.

## Consolidated action list, ranked

| # | Status | Action | Source |
| - | :---: | --- | --- |
| 1 | ✅ done | Ensure `MUTATIONS.insertAirports` invalidates all of a country's page types (now a single per-country `revalidateTag("country:<CC>")`, which covers `militaryAirports` / `aeroportAirports`) | best-practices, performance |
| 2 | ✅ done | Tighten `searchAirports` country validation: `z.string().max(2)` → `z.string().length(2)` | security |
| 3 | ✅ done | Migrate header logo to `next/image` | performance, best-practices |
| 4 | ✅ done (via Cloudflare Web Analytics) | Core Web Vitals are collected by the Cloudflare edge RUM beacon (CSP-allowlisted), not app code - no `@vercel/speed-insights` / `<SpeedInsights />` | performance |
| 5 | ✅ done | ESLint migrated to flat config (`eslint.config.mjs`); `pnpm lint` now runs as a gating step in CI | best-practices, regression |
| 6 | ⚠️ partial | Audit `src/components/schemas/*.tsx` for unnecessary `"use client"` (only `schema-product` was free; `schema-webpage` and `schema-website` use `usePathname()` and need a refactor to convert) | performance |
| 7 | ⚠️ partial | Add `headers()` in `next.config.mjs` for `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. CSP intentionally deferred - needs careful nonce/origin work to not break inline JSON-LD, AdSense, and Axiom. | security |
| 8 | ⏸ pending | Run UAT once against production | uat |
| 9 | ✅ done (DE) ⚠️ partial (cleanup) | DE ported to `HttpCrawlerBase` and added to the CI smoke test. Legacy `crawler_base.py` / `eurocontrol_base.py` plus `selenium` / `webdriver-manager` remain only because the experimental `belgium` / `car_sam_nam` / `pac_n` / `pac_p` / `run` crawlers still depend on them - none are wired into the active scheduler. | cross-cutting |
| 10 | ✅ done | Wire `@next/bundle-analyzer` as a `pnpm analyze` script | performance |

Items 1–5, 6 (partial), 7 (partial), 9, and 10 landed together; see commit history.

## What the CI gate currently catches (from `regression.md`)

Repeated here for the elevator pitch:

- Type errors anywhere in `src/`.
- Prettier drift.
- pnpm + uv lockfile drift.
- Python syntax errors.
- Crawler base-class import shape (AT/DE/FR/NL/UK).
- HTML parser behaviour for the eAIP menu (TAD_HP suffix, charts-related preference, last-link fallback, em-dash stripping).
- AT table parser behaviour.
- HTTP base lifecycle (close idempotency).
- Build success in CI (OpenNext `pnpm cf-build`, no DB).

What it does **not** catch: runtime middleware behaviour, end-to-end flows, visual regressions, bundle-size budget, web vitals. Each is documented in `regression.md` with cost/value tradeoffs.

## Sign-off

This QA assessment is "code-side complete" - the unit tests are merged, the docs land alongside this PR, the security and best-practices audits are anchored in real `pnpm audit` and `grep` output. UAT and live performance numbers are the remaining human-driven work.

---

_Last updated: 2026-05-06. Re-run per the commands in [`README.md`](./README.md)._
