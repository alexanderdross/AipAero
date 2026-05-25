# Quality Assessments

Snapshot assessments of the AIP:Aero website, crawlers, and backend. Each document is dated and contains both findings and runnable / repeatable steps.

| # | Assessment | File | Real-output basis |
| - | --- | --- | --- |
| 1 | QA assessment (overall) | [`qa.md`](./qa.md) | Cross-references the others; CI status; coverage gaps. |
| 2 | UAT assessment | [`uat.md`](./uat.md) | Manual checklist (must be executed by a human; runbook included). |
| 3 | Unit tests | [`unit-tests.md`](./unit-tests.md) | Real pytest suite at `crawlers/tests/`, gated in CI. |
| 4 | Regression test | [`regression.md`](./regression.md) | Strategy + the existing CI gate as the regression baseline. |
| 5 | Performance assessment | [`performance.md`](./performance.md) | Static code analysis + a runbook for Lighthouse / Web Vitals via Vercel. |
| 6 | Vercel / Next.js best practices | [`best-practices.md`](./best-practices.md) | Audit of the codebase against documented Vercel + App Router conventions. |
| 7 | Security assessment | [`security.md`](./security.md) | Real `pnpm audit` + `uv` dep tree output; manual code review of auth, validation, and SQL. |

## Scope

- **Website:** Next.js 15 App Router code under `src/`. Hosted on Vercel.
- **Crawlers:** Python (`uv`) under `crawlers/`. Run on netcup root server under systemd.
- **Backend:** the `/api/airports` ingest endpoint, the `searchAirports` server action, the Drizzle MySQL schema/queries, and the cache invalidation glue.

## How to re-run

The repeatable parts can be run from a clean checkout:

```bash
# Website
pnpm install --frozen-lockfile
pnpm typecheck
pnpm format:check
pnpm audit                              # security

# Crawlers
cd crawlers
uv sync --frozen
uv run pytest tests/                    # unit + regression
uv run python -m compileall -q .        # syntax check
```

The CI workflow at `.github/workflows/ci.yml` runs the same steps on every PR and gates merging via the `main` branch ruleset.

## Honest caveats

Two of the seven assessments are inherently human/runtime work and cannot be "executed" from this repo:

- **UAT** ([`uat.md`](./uat.md)) is a checklist — it depends on a person walking through the live site.
- **Performance** ([`performance.md`](./performance.md)) is half static-analysis findings, half a runbook for Lighthouse / Vercel Speed Insights / `next/bundle-analyzer`. We don't host a load-testing harness.

The other five (QA, unit tests, regression strategy, best-practices audit, security) are anchored in real, runnable output.

---

_Last updated: 2026-05-06._
