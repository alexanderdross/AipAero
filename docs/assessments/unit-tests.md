# Unit Tests

## Status

✅ **Implemented for the crawler subsystem.** 91 tests, all passing, gated in CI.

❌ **Not implemented for the website.** Justified below.

## What's tested

The pytest suite lives at `crawlers/tests/` and exercises the pure-function-shaped seams in the crawler code:

| File | Target | Tests |
| --- | --- | --- |
| `tests/test_http_base.py` | `HttpCrawlerBase` (fetch, frame chain, text helpers, lifecycle) | 16 |
| `tests/test_http_eurocontrol_base.py` | `extract_airports_from_html` — eAIP nav menu parsing for NL/UK/FR | 12 |
| `tests/test_at.py` | `AT.extract_airports` — Austrocontrol's table format | 18 |
| `tests/test_de.py` | `DE` — DFS BasicVFR/BasicIFR folder-link tree parsing + `myPermalink` resolution | 14 |
| `tests/test_fr.py` | `FR` — SIA eAIP edition selection + menu-section resilience | 14 |
| `tests/test_nl.py` | `NL` — LVNL AIRAC edition resolver | 11 |
| `tests/test_uk.py` | `UK` — NATS AIRAC edition selector | 6 |

Network is mocked with `httpx.MockTransport`; HTML is synthetic and mirrors the real shapes (frameset chains, eAIP menu pairs, `TAD_HP;TXT_NAME;NNNN` UK suffix, Austrocontrol section-header rows). No real outbound requests are made, so the suite runs in ~1.5s and is safe to run anywhere.

## Coverage of behaviours that previously broke silently

- **TAD_HP suffix in UK titles** — historically required a manual `split("TAD_HP")` workaround. Now regression-locked.
- **Em-dash stripping in NL titles** — the original Selenium parser stripped `—`. Locked.
- **`<a title*='charts related'>` preference vs last-`<a>` fallback** — both branches covered.
- **Austrocontrol "AD 3" section-header row skip** — locked; previously a magic string check that would silently mis-categorise if forgotten.
- **`HttpCrawlerBase.close()` idempotency** — previously the Selenium parent only called `.quit()` once; the httpx version is now safe to call repeatedly (e.g. once in `finally:`, once in `__exit__`).

## How to run

```bash
cd crawlers
uv sync --frozen           # installs pytest via [dependency-groups].dev
uv run pytest tests/       # quiet mode
uv run pytest tests/ -v    # verbose with test names
```

CI runs `uv run pytest tests/` on every PR and push to `main` (see `.github/workflows/ci.yml`, the *Crawlers (Python)* job).

## Why no website tests yet

Three reasons, in priority order:

1. **The risky logic is in the crawlers**, not the website. The website's "logic" is mostly Next.js routing + Drizzle queries + i18n message rendering — there's no business logic deeper than `eq(airports.country, X)` to test in isolation. Type-checking and end-to-end runtime in production catch the realistic failure modes.
2. **Deep component/RTL coverage is still non-trivial.** Adding broad Vitest / Jest + RTL coverage is non-trivial for an App Router project (server components, async server actions, `unstable_cache`-wrapped reads). It's worth doing before the next significant feature — not as a blanket "add tests" sweep.
3. **The four existing client components** (`menu`, `mobile-menu`, `breadcrumbs`, `search-input-field`, `locale-switcher-select`) are all thin wrappers over Radix primitives. Testing Radix is FAANG's job, not ours.

When unit tests are eventually added to the website, the natural starting points (in order of return-on-effort) are:

- `src/server/db/queries.ts` — the cache-tagged read paths and the bulk-replace insert.
- `src/server/actions.ts` — `searchAirports` input validation.
- `src/app/api/airports/route.ts` — request body validation, slug enrichment, auth.
- `src/lib/utils.ts` — pure helpers like `i18nPathMapping`.

## What this suite does not cover

- **DE crawler** — ✅ now covered. DE was ported off Selenium/`CrawlerBase` to `HttpCrawlerBase`, so it runs in CI; its tests are `tests/test_de.py` in the table above. (It was previously excluded as untestable without Chromium.)
- **End-to-end crawler runs** — these are integration tests against live AIP sites, which are slow, flaky from datacenter IPs, and out of scope for unit tests. The `output_handler.py` POST happens inside `main.py`; that's the natural end-to-end seam to mock if integration testing becomes valuable later.
- **Real network** — by design. Adding network-based tests would be flaky and slow; if a parser breaks because the upstream HTML changed, the real netcup cron run will fail loud and `error_logs/` will have the response body for diagnosis.

---

_Last updated: 2026-05-06._
