# QA Assessment

Top-level summary across the seven assessments. Each section has a verdict and a pointer to the detailed doc.

## Methodology

This QA assessment is a roll-up: it doesn't introduce new findings of its own. It indexes the other six assessments, calls out cross-cutting themes, and ranks the consolidated action list by ROI.

## Section verdicts

| Area | Verdict | Detail |
| --- | --- | --- |
| **Unit tests** | ✅ Now in place for the crawlers (29 tests, gated in CI). Website still uncovered, justified. | [`unit-tests.md`](./unit-tests.md) |
| **Regression** | ✅ CI gates typecheck + format + crawler unit tests + Vercel preview build. Lint and visual regression are gaps. | [`regression.md`](./regression.md) |
| **Performance** | ⚠️ Static analysis only — no live numbers yet. Three actionable bugs/gaps found. | [`performance.md`](./performance.md) |
| **Best practices** | ⚠️ Most App Router conventions followed correctly. Five concrete gaps, one is a real bug (missing `revalidateTag` calls). | [`best-practices.md`](./best-practices.md) |
| **Security** | ⚠️ Strong on auth + validation + SQL. Twenty-five transitive npm advisories (all dev-side or one-step-removed). One small input-validation tweak needed. | [`security.md`](./security.md) |
| **UAT** | ⏸ Runbook delivered. Awaiting human walk-through. | [`uat.md`](./uat.md) |

## Cross-cutting themes

### 1. The system is well-architected for its size

Single-author T3 stack project. Caching is right (cache-tag invalidation on writes, `"use cache"` on reads), separation of concerns is clean (server/`actions.ts` for `"use server"`, server/db/`queries.ts` for DB, env validation centralised), i18n correctly uses the modern `defineRouting` + `createNavigation` API. The crawlers were the worst offender (Selenium for everything) and have been migrated to httpx for 4/5 countries.

The split-host architecture (Vercel for web, netcup for crawlers) is correct — repeatedly re-evaluated, repeatedly the right answer.

### 2. The two real bugs found

Both surfaced in the best-practices audit, both small fixes:

| Bug | Where | Impact |
| --- | --- | --- |
| Missing `revalidateTag` calls for `militaryAirports` and `aeroportAirports` | `src/server/db/queries.ts:MUTATIONS.insertAirports` | France pages serve stale data for `cacheLife("hours")` after each crawl. |
| `country` validation accepts empty string and 1-char inputs | `src/server/actions.ts:schema` | Currently `z.string().max(2)` — should be `z.string().length(2)` or an enum from `routing.locales`. Allows malformed search requests through. |

Both are <5-line fixes.

### 3. Three "missed Vercel features" that would help

- `next/image` is unused — the header logo is loaded raw, so we don't get WebP negotiation, lazy loading, or auto-srcset.
- Vercel Speed Insights is not wired up — we have no Core Web Vitals data on the live site.
- `@next/bundle-analyzer` is not in devDependencies — no easy way to spot accidentally-shipped server deps in the client bundle.

### 4. The ESLint situation

`.eslintrc.mjs` is half-migrated: it's named for the legacy ESLint config but contains flat-config code, AND it imports the `typescript-eslint` package which isn't installed. Result: `next lint` falls into an interactive setup prompt and CI deliberately skips it. This is the single biggest gap in the regression gate — it means TS-aware lint rules (`no-misused-promises`, `consistent-type-imports`, drizzle's `enforce-update-with-where`) aren't catching anything on PRs.

Fix is small (rename to `eslint.config.mjs`, install `typescript-eslint` or rewrite the config to use only the installed packages directly), but it's its own change.

### 5. The DE crawler is the last Selenium debt

DE still inherits from the legacy `CrawlerBase`. Once it ports to `HttpCrawlerBase`:

- `crawlers/crawlers/crawler_base.py` and `eurocontrol_base.py` can be deleted.
- `selenium` and `webdriver-manager` come out of `pyproject.toml` (and `selenium` 4.32 → 4.43 upgrade pressure goes away).
- The CI smoke test can include DE, fully eliminating Chromium-on-CI as a constraint.
- Three CVE-adjacent transitive deps (`trio`, `wsproto`, etc.) drop out.

This is queued for the netcup access loop — the four already-ported crawlers need a real run there before we add DE on top.

## Consolidated action list, ranked

| # | Status | Action | Source |
| - | :---: | --- | --- |
| 1 | ✅ done | Add `revalidateTag("militaryAirports")` and `revalidateTag("aeroportAirports")` in `MUTATIONS.insertAirports` | best-practices, performance |
| 2 | ✅ done | Tighten `searchAirports` country validation: `z.string().max(2)` → `z.string().length(2)` | security |
| 3 | ✅ done | Migrate header logo to `next/image` | performance, best-practices |
| 4 | ✅ done | Enable Vercel Speed Insights in `[locale]/layout.tsx` | performance |
| 5 | ⏸ deferred | Fix the ESLint config so `pnpm lint` works, then add it to CI | best-practices, regression |
| 6 | ⚠️ partial | Audit `src/components/schemas/*.tsx` for unnecessary `"use client"` (only `schema-product` was free; `schema-webpage` and `schema-website` use `usePathname()` and need a refactor to convert) | performance |
| 7 | ⚠️ partial | Add `headers()` in `next.config.mjs` for `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. CSP intentionally deferred — needs careful nonce/origin work to not break inline JSON-LD, AdSense, and Axiom. | security |
| 8 | ⏸ pending | Run UAT once against production | uat |
| 9 | ⏸ deferred | Port DE crawler off Selenium; delete `crawler_base.py` + Selenium deps (needs netcup verification of the four already-ported crawlers first) | cross-cutting |
| 10 | ✅ done | Wire `@next/bundle-analyzer` as a `pnpm analyze` script | performance |

Items 1–4, 6 (partial), 7 (partial), and 10 landed together; see commit history.

## What the CI gate currently catches (from `regression.md`)

Repeated here for the elevator pitch:

- Type errors anywhere in `src/`.
- Prettier drift.
- pnpm + uv lockfile drift.
- Python syntax errors.
- Crawler base-class import shape (AT/FR/NL/UK).
- HTML parser behaviour for the eAIP menu (TAD_HP suffix, charts-related preference, last-link fallback, em-dash stripping).
- AT table parser behaviour.
- HTTP base lifecycle (close idempotency).
- Build success at deploy (Vercel preview).

What it does **not** catch: ESLint rules, runtime middleware behaviour, end-to-end flows, DE crawler, visual regressions, bundle-size budget, web vitals. Each is documented in `regression.md` with cost/value tradeoffs.

## Sign-off

This QA assessment is "code-side complete" — the unit tests are merged, the docs land alongside this PR, the security and best-practices audits are anchored in real `pnpm audit` and `grep` output. UAT and live performance numbers are the remaining human-driven work.

---

_Last updated: 2026-05-06. Re-run per the commands in [`README.md`](./README.md)._
