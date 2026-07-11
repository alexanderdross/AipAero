# Unit Tests

## Status

✅ **Implemented for the crawler subsystem.** 114 tests, all passing, gated in CI.

✅ **Implemented for the website.** 27 Vitest tests over the pure helpers + two leaf components, gated in CI.

## What's tested (crawlers)

The pytest suite lives at `crawlers/tests/` and exercises the pure-function-shaped seams in the crawler code:

| File | Target | Tests |
| --- | --- | --- |
| `tests/test_http_base.py` | `HttpCrawlerBase` (fetch, frame chain, text helpers, lifecycle) | 21 |
| `tests/test_http_eurocontrol_base.py` | `extract_airports_from_html` - eAIP nav menu parsing for NL/UK/FR | 12 |
| `tests/test_playwright_base.py` | `PlaywrightCrawlerBase` - lazy browser import + fail-soft rendering | 4 |
| `tests/test_at.py` | `AT.extract_airports` - Austrocontrol's table format | 18 |
| `tests/test_de.py` | `DE` - DFS BasicVFR/BasicIFR folder-link tree parsing + `myPermalink` resolution | 14 |
| `tests/test_dk.py` | `DK` - Naviair extraction on the Playwright-rendered DOM | 5 |
| `tests/test_fr.py` | `FR` - SIA eAIP edition selection + menu-section resilience | 14 |
| `tests/test_gr.py` | `GR` - Bright Data Web Unlocker zone selection | 4 |
| `tests/test_nl.py` | `NL` - LVNL AIRAC edition resolver | 11 |
| `tests/test_uk.py` | `UK` - NATS AIRAC edition selector | 6 |
| `tests/test_main.py` | `main.py` - active-crawler country selection / CLI args | 5 |

Network is mocked with `httpx.MockTransport`; HTML is synthetic and mirrors the real shapes (frameset chains, eAIP menu pairs, `TAD_HP;TXT_NAME;NNNN` UK suffix, Austrocontrol section-header rows). No real outbound requests are made (Playwright is stubbed in `test_playwright_base`/`test_dk`), so the suite runs in ~10s and is safe to run anywhere.

## Coverage of behaviours that previously broke silently

- **TAD_HP suffix in UK titles** - historically required a manual `split("TAD_HP")` workaround. Now regression-locked.
- **Em-dash stripping in NL titles** - the original Selenium parser stripped `-`. Locked.
- **`<a title*='charts related'>` preference vs last-`<a>` fallback** - both branches covered.
- **Austrocontrol "AD 3" section-header row skip** - locked; previously a magic string check that would silently mis-categorise if forgotten.
- **`HttpCrawlerBase.close()` idempotency** - previously the Selenium parent only called `.quit()` once; the httpx version is now safe to call repeatedly (e.g. once in `finally:`, once in `__exit__`).

## How to run

```bash
cd crawlers
uv sync --frozen           # installs pytest via [dependency-groups].dev
uv run pytest tests/       # quiet mode
uv run pytest tests/ -v    # verbose with test names
```

CI runs `uv run pytest tests/` on every PR and push to `main` (see `.github/workflows/ci.yml`, the *Crawlers (Python)* job).

## What's tested (website)

The Vitest suite runs with `pnpm test` (jsdom environment) and covers the pure, high-value logic seams - the aviation math and parsers where a silent regression would mislead a pilot, plus two leaf components:

| File | Target | Tests |
| --- | --- | --- |
| `src/lib/openaip-parse.test.ts` | OpenAIP airport-schema mapper (runways, frequencies, enums) | 9 |
| `src/lib/metar-decode.test.ts` | METAR/TAF token decoder + glossary | 7 |
| `src/lib/utils.test.ts` | pure helpers (`cn`, `i18nPathMapping`, slug/URL helpers) | 4 |
| `src/lib/crosswind.test.ts` | crosswind/headwind trigonometry from runway bearings | 3 |
| `src/components/box.test.tsx` | country/type card render | 2 |
| `src/components/external-link.test.tsx` | `rel="noopener noreferrer"` + target on outbound links | 2 |

The aviation-safety-relevant logic (wind components, METAR decode, OpenAIP field mapping) is deliberately prioritised: these are the site's most consequential pure functions, so they carry the deepest unit coverage. Server components, `"use server"` actions and `unstable_cache`-wrapped DB reads are exercised end-to-end by the Playwright suite (see [`functionality.md`](./functionality.md)) rather than in isolation, where an App Router harness would add cost for little marginal coverage.

Natural next starting points (in order of return-on-effort) if the website suite grows:

- `src/server/actions.ts` - `searchAirports` input validation.
- `src/app/api/airports/route.ts` - request body validation, slug enrichment, auth.
- `src/server/db/queries.ts` - the cache-tagged read paths and the bulk-replace insert.

## What this suite does not cover

- **DE crawler** - ✅ now covered. DE was ported off Selenium/`CrawlerBase` to `HttpCrawlerBase`, so it runs in CI; its tests are `tests/test_de.py` in the table above. (It was previously excluded as untestable without Chromium.)
- **End-to-end crawler runs** - these are integration tests against live AIP sites, which are slow, flaky from datacenter IPs, and out of scope for unit tests. The `output_handler.py` POST happens inside `main.py`; that's the natural end-to-end seam to mock if integration testing becomes valuable later.
- **Real network** - by design. Adding network-based tests would be flaky and slow; if a parser breaks because the upstream HTML changed, the scheduled *Crawl (publish)* run (and the *Crawler live test* dry run) will fail loud and `error_logs/` will have the response body for diagnosis.

---

_Last updated: 2026-07-11._
