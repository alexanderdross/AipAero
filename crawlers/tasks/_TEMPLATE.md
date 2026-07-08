# Python Crawler for &lt;Country&gt; Airports

> **Onboarding template.** Copy this file to `crawler_<country>.md`, fill in every
> `<...>` placeholder, and delete this note. All active crawlers are **httpx-based
> (no Selenium, no browser).** See the AT/DE/FR/NL/UK crawlers for working examples.

## Goal

Extract the airports for &lt;Country&gt; from the official AIP. Each airport carries:

- **ICAO code** — 4 capital letters; may be `None` if unpublished
- **Title** — airport name with the ICAO code appended at the end (e.g. `BRNO/Tuřany LKTB`)
- **URL** — link to the airport's chart page (the "Charts related to the aerodrome" entry)
- **airport_type** — one of `vfr`, `ifr`, `heliport`, `mil`, `aeroport` (use `aeroport` only when the source doesn't split the type)
- **Country code** — 2 letters; **for &lt;Country&gt; use `<CC>`**

## Implementation

1. Create `crawlers/crawlers/<cc>.py`.
2. Create a class inheriting **`HttpCrawlerBase`** (`from crawlers.http_base import HttpCrawlerBase`), or **`HttpEurocontrolBase`** (`from crawlers.http_eurocontrol_base import HttpEurocontrolBase`) when the source is a eurocontrol-style eAIP frameset. **No Selenium, no browser.**
3. Implement `crawl(self) -> list[Airport]`, fetching static HTML with the base helpers — `fetch()` / `soup()`, plus `follow_frame_chain()` and `extract_airports_from_html()` for eAIPs. **Return** the list of `Airport`; do not post it yourself.
4. Register the crawler in `crawlers/main.py`'s active list — `OutputHandler` posts the results to the API.
5. Add unit tests under `crawlers/tests/test_<cc>.py` (mirror the existing AT/DE/FR/NL/UK tests) and add the country to the CI import smoke test in `.github/workflows/ci.yml`.

If — and only if — the source genuinely requires JS rendering, the sole allowed fallback is a single **Playwright (Python)** path. Never Selenium, never Puppeteer/Node.

## Airport model (`crawlers/crawlers/models.py`)

```python
class Airport(BaseModel):
    country: str
    icao: str | None
    title: str
    url: str
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(alias="type")
```

## What to extract in detail for &lt;Country&gt;

**Source URL:** &lt;https://...&gt;

> Prefer a **static permalink** for each airport's chart URL when the AIP offers one
> (e.g. DFS exposes `…/pages/CNNNNN.html` permalinks), so saved links survive the
> AIRAC edition rename. See `de.py` for the pattern.

### airport_type
&lt;Describe the AD sections and how each maps to vfr / ifr / heliport / mil / aeroport.&gt;

### title
&lt;Notes on title formatting — the ICAO code goes at the end.&gt;

### icao
&lt;Where the 4-letter ICAO appears; may be `None`.&gt;

### url
&lt;Which link to capture — the "Charts related to the aerodrome" entry.&gt;

## Verification

Run the crawl locally with `api_endpoint` pointed at `http://localhost:3000`
(`uv run main.py`) and share the `OutputHandler` log/print so the extracted set
can be checked before wiring it into the scheduled run.
