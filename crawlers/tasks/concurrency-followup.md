# Follow-up: parallelise the crawl (per-field AD 2.3 fetches / countries)

**Status: documented, NOT implemented.** Deferred deliberately - it is the
largest run-time lever in the crawler subsystem, but also carries the highest
regression and rate-limit risk of the open follow-ups, so it warrants its own
change with a dedicated review focus.

## The problem

The whole crawl is **fully sequential** today:

- `main.py:main()` iterates `COUNTRY_CRAWLERS` (~50 countries) in a plain
  `for` loop, one country fully finished before the next starts.
- Inside a eurocontrol country, `HttpEurocontrolBase.collect_ad23_hours(airports)`
  does **one HTTP GET per aerodrome** (AD 2.3 operating hours), also in a
  sequential loop, and it runs *after* the main crawl - so a big country pays a
  second full round of per-field round-trips serially.
- `HttpCrawlerBase.attach_pdf_urls()` (opt-in `FETCH_PDF_URLS`) is likewise one
  GET per field.
- Backoff is a **blocking `time.sleep`** (`http_base.fetch_response`), so a
  retry stalls the entire run.

For a country like DE/UK/FR (hundreds of fields), the per-field AD 2.3 pass
dominates wall-clock. This is the single biggest time sink.

## Why it is deferred (the risk)

- **Rate limits / WAF bans.** Several sources are already touchy
  (skeyes/BE, HASP/GR, ans.lt, aisro.ro) and some go through metered proxies
  (Bright Data). Firing N concurrent requests at one host risks 429s, IP bans,
  or extra proxy cost. Any concurrency MUST be **per-host bounded** (a small
  semaphore per origin), not a global fan-out.
- **Shared mutable state.** `HttpCrawlerBase` holds one pooled `httpx.Client`
  and per-crawler dicts (`hours_by_icao`, `hours_source_by_icao`,
  `declared_by_icao`, `_last_pdf_ocr`). `_last_pdf_ocr` in particular is a
  single instance flag read right after `pdf_text()` in `collect_pdf_hours` -
  it is **not** safe under concurrency and would need to become a per-call
  return value.
- **Playwright** (DK/RS) is single-browser and not thread-safe; those crawlers
  must stay sequential (or get their own isolation).
- **Ordering / determinism.** The drop-guard, dedup (`sanitize.py`) and the
  title/PDF coverage warnings assume a stable per-country list; concurrency
  must preserve final ordering (or sort before publish) so runs stay
  reproducible and diffs stay meaningful.
- **Error isolation.** Today one country failing is caught per-iteration in
  `main.py`; a concurrent model must keep that isolation (one field/country
  failing must not sink the batch).

## Suggested approach (when picked up)

Scope it in two independent, separately-reviewable steps - the intra-country
field fan-out first (biggest win, smallest blast radius), countries second.

1. **Parallelise the per-field AD 2.3 (and PDF) fetches _within_ a country**,
   bounded by a small per-host concurrency cap (e.g. 4-6). Options:
   - a `concurrent.futures.ThreadPoolExecutor` around `collect_ad23_hours` /
     `attach_pdf_urls` (httpx `Client` is usable across threads if each request
     is independent), or
   - migrate the per-field fetch path to `httpx.AsyncClient` + `asyncio` with a
     semaphore. Async is cleaner for backoff (no blocking sleep) but is a
     larger change to the base class.
   Precondition: make `_last_pdf_ocr` a **return value** of `pdf_text`
   (e.g. `pdf_text(url) -> (text, used_ocr)`), not an instance flag, so the OCR
   provenance is race-free. Keep the final airport/hours ordering stable.

2. **Parallelise across countries** in `main.py` with a modest global cap
   (e.g. 3-4 countries at once), each country still publishing independently.
   Skip the Playwright crawlers from the concurrent pool (run them serially).
   Keep the per-country try/except isolation and the shared `OutputHandler`
   thread-safe (its `last_run_counts.json` read/write + `_send_with_retry` must
   be guarded, or give each country its own handler and merge counts at the end).

## Validation when implemented

- The `crawler-live-test.yml` dry run (no publish) on a few large countries
  (UK/FR/DE) - compare field counts + wall-clock against a sequential baseline;
  they must match on counts.
- Watch for 429 / WAF blocks in the run log with concurrency on (tune the
  per-host cap down until clean).
- `pytest` must stay green: add a test that the concurrent field-fetch path
  preserves ordering and that `_last_pdf_ocr` provenance is correct per field
  (the race the return-value refactor fixes).
- Keep it behind an env flag at first (e.g. `CRAWLER_CONCURRENCY=1`) so the
  scheduled crawl can fall back to sequential instantly if a source misbehaves.
