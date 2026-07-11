# Quality Assessments

Snapshot assessments of the AIP:Aero website, crawlers, and backend. Each document is dated and contains both findings and runnable / repeatable steps.

| # | Assessment | File | Real-output basis |
| - | --- | --- | --- |
| 1 | QA assessment (overall) | [`qa.md`](./qa.md) | Cross-references the others; CI status; coverage gaps. |
| 2 | UAT assessment | [`uat.md`](./uat.md) | Manual checklist (must be executed by a human; runbook included). |
| 3 | Unit tests | [`unit-tests.md`](./unit-tests.md) | Real pytest suite at `crawlers/tests/`, gated in CI. |
| 4 | Regression test | [`regression.md`](./regression.md) | Strategy + the existing CI gate as the regression baseline. |
| 5 | Performance assessment | [`performance.md`](./performance.md) | Static code analysis + a runbook for Lighthouse / Web Vitals against the live site. |
| 6 | Cloudflare Workers / Next.js best practices | [`best-practices.md`](./best-practices.md) | Audit of the codebase against documented Cloudflare Workers + App Router conventions. |
| 7 | Security assessment | [`security.md`](./security.md) | Real `pnpm audit` + `uv` dep tree output; manual code review of auth, validation, and SQL. |
| 8 | Functionality test | [`functionality.md`](./functionality.md) | Real Playwright E2E (94), Vitest (27), pytest (114), production build. |
| 9 | Crawler dry run | [`dry-run.md`](./dry-run.md) | Real `crawler-live-test` run: 10/12 live, 1,503 airports parsed (no publish). |

## Scope

- **Website:** Next.js 15 App Router code under `src/`. Hosted on Cloudflare Workers (via the OpenNext adapter).
- **Crawlers:** Python (`uv`) under `crawlers/`. Run as scheduled GitHub Actions workflows on the self-hosted runner (Coolify/netcup box), not systemd.
- **Backend:** the `/api/airports` ingest endpoint, the `searchAirports` server action, the Drizzle Cloudflare D1 (SQLite) schema/queries, and the cache invalidation glue.

## How to re-run

The repeatable parts can be run from a clean checkout:

```bash
# Website
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check && node scripts/check-i18n.mjs
pnpm test                               # Vitest unit
pnpm audit --audit-level=high --prod    # security
SKIP_ENV_VALIDATION=1 pnpm build        # production build
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm test:e2e   # E2E / functionality

# Crawlers
cd crawlers
uv sync --frozen
uv lock --check
uv run pytest tests/                    # unit + regression
uv run python -m compileall -q crawlers main.py output_handler.py settings.py
# Live dry run (no publish): Actions → "Crawler live test" → Run workflow
```

The CI workflow at `.github/workflows/ci.yml` runs the same steps on every PR and gates merging via the `main` branch ruleset.

## Honest caveats

Two assessments are inherently human/runtime work and cannot be fully "executed" from this repo:

- **UAT** ([`uat.md`](./uat.md)) is a checklist - it depends on a person walking through the live site.
- **Performance** ([`performance.md`](./performance.md)) is half static-analysis findings, half a runbook for Lighthouse / Cloudflare Web Analytics / `next/bundle-analyzer`. We don't host a load-testing harness.

The other seven (QA, unit tests, regression, best-practices audit, security, functionality, dry run) are anchored in real, runnable output.

---

_Last updated: 2026-07-11._
