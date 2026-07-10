# Airport Crawlers

Python web scrapers that extract aerodrome / heliport / military airfield listings from the official AIP publications of European civil-aviation authorities and POST them to the AIP:Aero API.

## Hosting

The crawlers run as **GitHub Actions workflows on the self-hosted runner** (the runner lives on the Coolify/netcup box and also runs the crawler live-test). This replaced the old systemd timer on a bare-metal netcup host: Actions checks out the repo fresh each run (no code drift), gives run logs + a manual trigger, and needs no crawler Dockerfile or baked-in browser.

- **`.github/workflows/crawl.yml`** — *Crawl (publish)*. Runs `uv run main.py` daily (03:00 UTC) and POSTs to `https://aip.aero/api/airports` (Bearer `CRON_SECRET`). Manually triggerable, optionally for a subset of countries. Installs headless Chromium per run for the DK Playwright fallback. Persists `last_run_counts.json` via `actions/cache` so the OutputHandler's > 50 % drop guard survives the ephemeral runner.
- **`.github/workflows/facts-import.yml`** — *Airport facts import*. Runs `import_ourairports.py` weekly (Sun 03:30 UTC) → POSTs OurAirports facts to `/api/airport-facts`. Idempotent.
- **`.github/workflows/crawler-live-test.yml`** — dry-run validation (no publish) for new/changed crawlers.

Secrets used (repo → Settings → Secrets and variables → Actions): `CRON_SECRET` (required), `BRIGHTDATA_UNLOCKER_URL` (GR captcha), `BRIGHTDATA_PROXY_URL` (optional). During local development, run `main.py` directly and point `API_ENDPOINT` at `http://localhost:3000/api/airports`.

The website itself runs on Cloudflare Workers (via the OpenNext adapter). Serverless platforms (Cloudflare Workers, Vercel, Lambda, etc.) are explicitly **not** a target for running the crawlers: scheduled, browser-capable scraping doesn't fit that runtime model - hence the self-hosted runner.

## Stack

- Python ≥ 3.12, managed with [uv](https://github.com/astral-sh/uv)
- HTTP: `httpx` + `BeautifulSoup` for static pages - the only path in use; all twelve active crawlers (AT, DE, FR, NL, UK, BE/LU, CZ, DK, GR, NO, PL, SE) are on it
- Browser fallback: a single Playwright (Python) path for sites that genuinely require JS rendering — only when there's no static URL to follow
- Pydantic for the `Airport` model (`crawlers/crawlers/models.py`) and settings

> **Note on Selenium.** The original crawlers used Selenium + `webdriver-manager`. None of the active sites need a JS engine — they serve static HTML, sometimes inside legacy framesets. **All twelve active crawlers are now off Selenium** and run on httpx. The legacy `crawler_base.py` / `eurocontrol_base.py` (Selenium) modules remain only for the experimental, non-scheduled crawlers (belgium, car_sam_nam, pac_n, pac_p, run); once those are ported or pruned, `selenium` + `webdriver-manager` can be removed. New crawlers must not introduce Selenium. **Do not** use Puppeteer (Node-only) or any other browser stack.

## Base classes

| Module                    | Class                  | Use when                                                 |
| ------------------------- | ---------------------- | -------------------------------------------------------- |
| `http_base.py`            | `HttpCrawlerBase`      | The source serves static HTML over HTTP (default choice). |
| `http_eurocontrol_base.py`| `HttpEurocontrolBase`  | The source is a eurocontrol-style eAIP frameset (used by most eAIP crawlers: NL, UK, FR, BE, CZ, GR, NO, PL, SE). |
| `crawler_base.py`         | `CrawlerBase`          | *Legacy, Selenium.* No active crawler uses it; kept only for the experimental (unscheduled) crawlers. |
| `eurocontrol_base.py`     | `EurocontrolBase`      | *Legacy, Selenium.* Orphaned, slated for deletion.       |

`HttpCrawlerBase` provides `fetch(url, encoding=…)`, `soup(html)`, `get_frame_src(html, base_url, name)`, `follow_frame_chain(start_url, [name1, name2, …])`, `clean_text(text)`, and `save_response(url, body, prefix)` for dumping the last response to `error_logs/` on failure. `HttpEurocontrolBase` adds `extract_airports_from_html(html, base_url, id_in_menu, category)`, which parses the standard eAIP nav menu (paired title/details `<div>`s) and prefers `<a title*='charts related'>` for the airport's chart URL.

## Country Status

Active (in `crawlers/`) - 12 countries:

- [x] Austria (https://eaip.austrocontrol.at) - `HttpCrawlerBase`
- [x] Germany (https://aip.dfs.de/) - `HttpCrawlerBase` (DFS BasicVFR/BasicIFR; enters at static `pages/CNNNNN.html` section URLs and stores each airport's amendment-stable `myPermalink`)
- [x] France (https://www.sia.aviation-civile.gouv.fr/plandesite) - `HttpEurocontrolBase`
- [x] Netherlands (https://eaip.lvnl.nl/) - `HttpEurocontrolBase`
- [x] United Kingdom (https://nats-uk.ead-it.com/) - `HttpEurocontrolBase`
- [x] Belgium + Luxembourg (https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/index-en-GB.html) - `HttpEurocontrolBase`
- [x] Czech Republic (https://aim.rlp.cz/eaip/html/index-en-GB.html) - `HttpEurocontrolBase`
- [x] Denmark (https://aim.naviair.dk/) - `HttpCrawlerBase` (custom Naviair navigation)
- [x] Greece (https://aisgr.hasp.gov.gr/) - `HttpEurocontrolBase`
- [x] Norway (https://avinor.no/en/ais/aipnorway/) - `HttpEurocontrolBase`
- [x] Poland (https://www.ais.pansa.pl/en/publications/aip-poland/) - `HttpEurocontrolBase`
- [x] Sweden (https://aro.lfv.se/content/eaip/default_offline.html) - `HttpEurocontrolBase`

Known issues (current AIRAC cycle, 2026-07; see `docs/open-tasks.md`):

- **DE / FR** - FIXED. Both source entry points moved this cycle: DFS now serves
  the `pages/CNNNNN.html` entries as `<meta refresh>` stubs (de.py follows them),
  and SIA's `home.html` is JS-driven with the eAIP index under an
  `AIRAC-YYYY-MM-DD/html/` subfolder (fr.py derives it from `home.js`). Verified
  live (DE 792, FR 143).
- **GR** - the Bright Data Web Unlocker returns `502 Access denied` for
  `aisgr.hasp.gov.gr` (likely a Bright-Data compliance/KYC block on the `.gov`
  domain, not our selectors); needs a Bright-Data-side fix/allowlist before the
  selectors can be validated. Owner diagnosis steps in `docs/open-tasks.md` #4.
- **DK** - parked in `ALLOWED_FAILURES`: `aim.naviair.dk` is an AngularJS SPA
  whose AIP tree loads asynchronously into click-driven tree items (no
  `<a href>`, no iframe, no HTML-discoverable data endpoint), so the text-link
  crawler can't navigate it. A fix needs Playwright click-navigation or the
  tree's data API - see `crawlers/tasks/crawler_denmark.md` + open-tasks.md #3.

Open (see `tasks/` for per-country research notes):

1. [ ] Croatia (https://www.crocontrol.hr/UserDocsImages/AIS%20produkti/eAIP/start.html)

Further candidates (no task spec yet): Switzerland, Italy, Spain.

## What to extract

From each country's **AIP PART 3 — AD (Aerodromes)**:

- ~AD 0 AERODROMES~ (skipped)
- ~AD 1 AERODROMES-HELIPORTS — INTRODUCTION~ (skipped)
- **AD 2 AERODROMES** (extracted)
- **AD 3 HELIPORTS** (extracted)
- **AD 4 MILITARY** (extracted)

For each airport, capture:

- ICAO code (4 capital letters), if published
- Title of the airport
- URL pointing to the airport's chart page

Each airport has exactly one category:

- `vfr`
- `ifr`
- `heliport`
- `mil`
- `aeroport` (only when the source publication doesn't categorise the airfield)

## Crawler interface

Every country crawler inherits `HttpCrawlerBase` (or `HttpEurocontrolBase` for eurocontrol eAIPs) and implements `crawl()`, returning a list of:

```python
class Airport(BaseModel):
    country: str
    icao: str | None
    title: str
    url: str
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(alias="type")
```

The model lives in `crawlers/crawlers/models.py`. Register the new crawler in `main.py`; output is written by `OutputHandler.write_output(airports, country)`.

A minimal eurocontrol-style crawler looks like:

```python
from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

class XX(HttpEurocontrolBase):
    def __init__(self): super().__init__("XX")

    def crawl(self) -> list[Airport]:
        try:
            edition_url = ...                              # find current edition
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            return [
                *self.extract_airports_from_html(nav_html, nav_url, "AD-2details", "vfr"),
                *self.extract_airports_from_html(nav_html, nav_url, "AD-3details", "heliport"),
            ]
        finally:
            self.close()
```

## Running & re-triggering a crawl

Local run:

```bash
uv sync
uv run main.py            # crawls all active countries (AT, DE, FR, NL, UK, BE/LU, CZ, DK, GR, NO, PL, SE)
uv run main.py NL UK      # crawls only the given countries (codes are case-insensitive)
```

In production the crawl runs via the **Crawl (publish)** Actions workflow (daily + manual). To re-trigger on demand (e.g. after a source publishes a new AIRAC edition): GitHub → **Actions → Crawl (publish) → Run workflow**, optionally passing a space-separated `countries` input for a subset, and `force_publish` to override the drop guard.

**Re-triggering a single country (e.g. NL and UK):** pass the country codes — via the workflow's `countries` input, or locally `uv run main.py NL UK` (codes are case-insensitive; an unknown code aborts the run rather than silently crawling a subset). Each country POST is independent: it replaces only that country's rows via a D1 batch and busts only its `country:<CC>` cache tag, so re-crawling a subset never touches the others. `OutputHandler` refuses to publish a country whose airport count dropped > 50 % from the last successful run; override with `CRAWLER_FORCE_PUBLISH=1` (the workflow's `force_publish` input sets this).

Logs go to stdout and to `crawlers.log`. On failures, the crawlers persist the last response body to `error_logs/` via `save_response()` so the failure can be reproduced offline against the same bytes the parser saw.

## Adding a new country

1. Copy `tasks/_TEMPLATE.md` to `tasks/crawler_<country>.md` and fill in the source URL, the AD-section → type mapping, and the title/ICAO/URL extraction notes.
2. Implement `crawlers/crawlers/<cc>.py` inheriting `HttpCrawlerBase` (or `HttpEurocontrolBase` for eurocontrol eAIPs) — see the “Crawler interface” section below and the existing AT/DE/FR/NL/UK crawlers.
3. Register the class in `main.py`'s active list.
4. Add `crawlers/tests/test_<cc>.py` and include the country in the CI import smoke test.
5. Prefer a **static permalink** for each airport's chart URL when the source offers one, so links survive AIRAC amendments (see `de.py`).

## Aerodrome facts importer (OurAirports)

Besides the country crawlers, `import_ourairports.py` populates the website's
embedded aerodrome-facts card (runways / frequencies / coordinates / elevation).
It downloads the public-domain OurAirports CSVs, filters them to the 12 covered
countries, and POSTs normalized per-ICAO rows to `POST /api/airport-facts` (same
`CRON_SECRET` Bearer auth as the crawlers). The website merges these with OpenAIP
at request time when `OPENAIP_API_KEY` is set. This is **not** a country crawler
and is not run by `main.py`.

In production this runs weekly via the **Airport facts import** Actions workflow (`.github/workflows/facts-import.yml`, Sun 03:30 UTC) and is manually triggerable (Actions → *Airport facts import* → *Run workflow*). Run it once manually to populate the facts the first time. Locally / explicitly:

```bash
API_BASE=https://aip.aero API_KEY=<CRON_SECRET> uv run python import_ourairports.py
# reuses the crawlers' .env for API_ENDPOINT/API_KEY if present
```

## Architecture

```mermaid
flowchart TD
 subgraph subGraph0["Next.js Application (Cloudflare Workers, https://aip.aero)"]
        API["API Endpoint /api/airports"]
        Website["Website"]
        InsertAction["Server Action: Insert Airports"]
        ReadAction["Server Action: Read Airports"]
        Cache["Cache (R2 incr. + D1 tag cache)"]
        IsHit{"Cache hit?"}
  end
 subgraph subGraph1["Self-hosted GitHub Actions runner (scheduled workflow)"]
        Crawlers["Airport Crawlers (Python, this subproject)"]
  end
    Crawlers -- POST data + CRON_SECRET --> API
    API -- calls --> InsertAction
    InsertAction -- inserts airports (D1 batch) --> D1[("Cloudflare D1")]
    InsertAction -- "revalidateTag(country:CC)" --> Cache
    Website -- uses --> ReadAction
    ReadAction -- queries airports --> Cache
    Cache --> IsHit
    IsHit -- No --> D1
```
