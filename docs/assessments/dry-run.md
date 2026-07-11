# Crawler Dry Run

A **dry run** exercises every country crawler against its **live** AIP source and
reports what it parses, **without publishing** anything (no `OutputHandler`, no
`POST /api/airports`, no D1 write). It is the only way to validate the real
navigation/parse path end-to-end - the unit tests use mocked HTML, so only a dry
run catches an upstream source that changed its markup or URLs (as DE/FR did in
the 2026-07 AIRAC cycle).

_Last executed: 2026-07-11 (all 12 countries)._

## How it runs

Dry runs never hit production. Two entry points:

- **CI / runner (canonical):** the **`Crawler live test`** workflow
  (`.github/workflows/crawler-live-test.yml`) on the self-hosted runner. It calls
  each crawler's `crawl()` directly and prints the parsed airports - it never
  constructs `OutputHandler`, so nothing is written. Trigger: Actions → *Crawler
  live test* → *Run workflow*, optional space-separated `countries` input
  (default: the 7 newer ones). It also runs automatically on a PR that touches
  `crawlers/crawlers/**`.
- **Local:** `cd crawlers && uv run python -c "from crawlers.de import DE; \
  print(len(DE().crawl()))"` for a single crawler. NOTE: the live AIP hosts are
  **not reachable from the sandboxed CI/agent environment** (the egress proxy
  blocks non-allowlisted hosts), so a real local dry run only works from a box
  with open outbound (the runner, or a dev machine).

`ALLOWED_FAILURES` in the workflow is `DK GR`: those two are known-blocked, so
their failure does not fail the job while the rest must pass.

> A dry run is **not** the same as `crawl.yml` (*Crawl (publish)*), which DOES
> POST to `https://aip.aero/api/airports`. Use the dry run to validate; use
> *Crawl (publish)* only when you intend to write.

## Result - 2026-07-11 (run 29143448110, all 12 countries)

Job passed (`Only known-blocked countries failed: ['DK','GR'] - passing.`).

| Country | Airports | Status |
| - | -: | --- |
| AT | 72 | ✅ OK |
| DE | 792 | ✅ OK |
| FR | 143 | ✅ OK |
| NL | 24 | ✅ OK |
| UK | 122 | ✅ OK |
| BE | 167 | ✅ OK |
| CZ | 11 | ✅ OK |
| NO | 55 | ✅ OK |
| PL | 69 | ✅ OK |
| SE | 48 | ✅ OK |
| **DK** | 0 | ⚠️ allowed failure |
| **GR** | 0 | ⚠️ allowed failure |

**10 of 12 live, 2,203 airports parsed.** DE (792) and FR (143) confirm the
2026-07 AIRAC-cycle fixes hold (DE meta-refresh follow; FR `home.js` AIRAC-dated
index path).

### The two allowed failures

- **DK** - `no nav link matching ('VFR Flight Guide')`. `aim.naviair.dk` is an
  AngularJS SPA whose AIP tree loads asynchronously into click-driven tree items
  (no `<a href>`); the text-link follow can't navigate it. Parked - see
  `docs/open-tasks.md` #3 and `crawlers/tasks/crawler_denmark.md`.
- **GR** - `GET https://aisgr.hasp.gov.gr/ "HTTP/1.1 502 Access denied"` from the
  Bright Data Web Unlocker (likely a `.gov` compliance/KYC block). Owner
  diagnosis steps in `docs/open-tasks.md` #4.

## What the dry run guards against

- Upstream markup / URL changes (the AIRAC-cycle regression class).
- The `> 50%` count-drop guard's baseline (a huge drop shows up as a low count
  here before it can be published).
- A crawler that fails to import or launches a browser at import time.

## How to re-run

```
# Runner (canonical) - Actions → Crawler live test → Run workflow
#   countries: "AT DE FR NL UK BE CZ DK GR NO PL SE"   (empty = the 7 newer ones)

# Local single crawler (needs open outbound; not the sandbox)
cd crawlers && uv sync --frozen
uv run python - <<'PY'
from crawlers.at import AT
print("AT:", len(AT().crawl()))
PY
```
