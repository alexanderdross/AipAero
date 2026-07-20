# Airfield Operation Hours - Concept

## The problem

Pilots frequently plan a flight **after office hours** to a field that is still open, and want to answer a very concrete question quickly:

> "Which airfields are open until 19:00?"

Today AIP:Aero shows opening hours only as a **single free-text row** on the airport-detail page (`opening_hours` on `airport_facts`). There is no structured representation, so the hours cannot be compared, filtered, or queried - "open now" and "open until X" are impossible.

This concept makes operation hours **structured and queryable**, adds an advisory **open/closed status** to the detail page, a **map filter** ("open now" / "open until [time]") on the airport-list page, enriches the **Airport JSON-LD** with `openingHoursSpecification`, and captures the **authoritative eAIP AD 2.3 "Operational Hours"** where the source publishes it.

## Where does the data come from?

| Source                                            | What it gives                                     | Format                                                                        | Persisted today?                                                | Role                                           |
| ------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| **OpenAIP `hoursOfOperation.operatingHours[]`**   | per-day open/close, sunrise/sunset, byNotam flags | structured `{ dayOfWeek 0..6, startTime, endTime, sunrise, sunset, byNotam }` | No - fetched live, then **flattened to a string and discarded** | **Primary**                                    |
| **eAIP AD 2.3 OPERATIONAL HOURS**                 | official aerodrome operational hours              | free-text tabular (`H24`, `MON-FRI 0800-1700`, `O/R`, `HO`)                   | No - not parsed                                                 | **Authoritative fallback** (overrides OpenAIP) |
| **OpenStreetMap `opening_hours`**                 | sparse community hours                            | OSM syntax (`Mo-Fr 08:00-18:00`)                                              | No - display-only                                               | opportunistic (unchanged)                      |
| **Local sunrise/sunset** (`src/lib/sun-times.ts`) | resolves `SR`/`SS` windows to real times          | already in the codebase                                                       | n/a                                                             | enabler                                        |

Key finding: the **richest structured source is already fetched and then thrown away.** `parseOpeningHours` in `src/lib/openaip-parse.ts` takes OpenAIP's structured `operatingHours[]` and collapses it into a display string like `"Mon-Fri 08:00-20:00; Sat SR-SS"`. We keep that string for display but now also capture the structure.

The **authoritative** hours live in the eAIP **AD 2.3** section, which sits in the very pages the eurocontrol crawlers already fetch (the base reads the AD 2.1 name from the same aerodrome page). AD 2.3 is free-text/tabular ICAO layout, so it needs a per-country-tolerant normalizer, but it is the compliance-grade source and overrides OpenAIP where present.

### Live coverage findings (19.07.2026) - OpenAIP hours are NOT usable in practice

The plan above bet on OpenAIP `hoursOfOperation` as the **primary** source. Live probing disproved that: across **13 fields** sampled in DE/ES/CH/FR (major airports and small GA fields), OpenAIP returned **no** structured hours - and this was checked on **both** the `?search=<ICAO>` list endpoint AND the `/api/airports/{id}` detail endpoint (`hoursOfOperation` came back `absent` / `None` every time). So it is not a projection quirk; OpenAIP simply does not populate the field for these aerodromes. A full bulk backfill would resolve ~0 rows.

Consequences:

- The **OpenAIP hours backfill** (`import_openaip_backfill.py` `BACKFILL_HOURS` mode + `GET /api/airport-facts?scope=hours` + the `hours_backfill` workflow input) is built and merged, but **dormant** - it stays as harmless scaffolding in case OpenAIP ever fills the field, and it is safe to run (fail-soft, hours-only PATCH, eAIP precedence preserved). Do **not** expect meaningful yield from it today.
- **eAIP AD 2.3 (15 eurocontrol countries) is the only real source of operation hours** we currently have.
- Everywhere else the detail page now shows the honest **"no operating hours" note** (`Weather.hoursNone`) instead of a blank.

### Extending to non-eurocontrol countries (the real path)

Since OpenAIP is out, non-eurocontrol hours must come from the national AIP itself. The **`ad23_hours()` parser is source-agnostic** (it takes collapsed page text), so:

- **PDF AD 2 text** - the reference path, **live-proven on ES/ENAIRE (50/51 aerodromes)**. ENAIRE's `LE_AD_2_<ICAO>_en.html` page carries only the AD 2.1 name; the AD 2.3 OPERATIONAL HOURS table lives in the **full-document PDF** (`LE_AD_2_<ICAO>_en.pdf`, same path). `es.py` fetches that PDF (sibling of the page it already reads for the name), extracts text via `HttpCrawlerBase.pdf_text()` (pypdf, lazy import, fail-soft), and runs the **source-agnostic `ad23_hours()`** - no parser change needed. ENAIRE's row-1 shape `1 Airport V: 0430-2230; I: 0530-2330 ...` isolates correctly (row-2 number marker), yielding the VFR window (LECO -> 04:30-22:30), the AIS/ARO `H24` ignored. Cost: one extra ~2.4 MB PDF fetch per field (~120 MB / ES crawl, ~2-3 min). Same recipe applies to **GR/HASP, RO/AISRO, LT** (per-country: find the AD 2 **text** PDF, confirm `pypdf` linearises it - the live-test `pdf_dump` input).
- **HTML AD 2 pages that ARE non-eurocontrol but inline the AD 2.3 text**: run `ad23_hours()` directly on the page text the crawler already has - no PDF fetch. (ES turned out NOT to be this - its HTML has no AD 2.3. **DE/DFS is not this either** - see the DE recon below.)
- **Gated/licensed** (EAD): structured but not open.

`main.py` publishes `hours_by_icao` for **any** crawler (a `getattr`, not eurocontrol-gated), so a non-eurocontrol crawler that populates `self.hours_by_icao` (like `es.py`) publishes AD 2.3 hours with no extra wiring.

## Safety framing (owner directive)

Hours are shown as **advisory** - clearly labelled "confirm via NOTAM / current AIP before flight". Fields whose status is **unknown / by NOTAM / on-request (O/R)** are **excluded from "open" results** rather than guessed. This mirrors the project's existing "no best-effort entries" rule for customs and border-crossing links: a wrong "open" answer is a safety/operational hazard.

## Data model

A new structured, queryable column on `airport_facts`, kept **alongside** the human-readable `opening_hours` string:

- **`hours_structured` (TEXT, JSON)** - 7 entries (index 0 = Monday .. 6 = Sunday), each `{ open, close, flag }`:
  - `open` / `close` are **minutes after UTC midnight** (0..1439), or `null` for sun-relative / unknown days. AIP AD 2.3 hours are published in **UTC** (ICAO Annex 15; aviation "Zulu"), so all clock times and the day-of-week are UTC - `openStatus`/`isOpenUntil` compute in UTC and the UI labels times with `Z` / "UTC". (This replaced an earlier longitude-based local-time approximation, which was both wrong for a UTC source and imprecise.)
  - `flag ∈ { "fixed", "sunrise", "sunset", "h24", "notam", "closed", "unknown" }`.
    - `fixed` - concrete `open`/`close` clock minutes.
    - `sunrise` / `sunset` - the boundary is solar; resolved per-day from coordinates at read time.
    - `h24` - open all day.
    - `closed` - explicitly closed that day.
    - `notam` / `unknown` - not assertable; **excluded** from "open" answers.
- **`hours_source` (TEXT)** - provenance of `hours_structured`: `"eaip"` (authoritative) or `"openaip"` (community). Drives the precedence rule and the source label on the badge.

The canonical shape is defined once in `src/lib/opening-hours.ts` (`DayHours`, `StructuredHours`) and mirrored in Python (`crawlers/crawlers/operating_hours.py`).

### Precedence

`hours_source = "eaip"` **wins** over `"openaip"`. The `upsertAirportFacts` / `persistAirportFacts` conflict clauses use a guarded update (not a blind `COALESCE`) so a later OpenAIP run cannot clobber an eAIP value, while a fresh eAIP value still replaces an older OpenAIP one. Both remain fail-soft / COALESCE-preserving against `null`.

## Logic (`src/lib/opening-hours.ts`, pure + unit-tested)

- `parseStructuredHours(hoursOfOperation)` - map OpenAIP `operatingHours[]` -> `StructuredHours`. `parseOpeningHours` (the existing display-string builder) is refactored to build **from** this structured form, so the string and the structure never diverge.
- `resolveWindow(day, coords, when)` - turn one day into concrete open/close **UTC** minutes-of-day, resolving `sunrise`/`sunset` via `getSunTimes` (the sun instant's UTC minute-of-day; coordinates are still needed for the solar calc).
- `openStatus(structured, coords, when)` -> `{ state: "open" | "closed" | "unknown", closesAt?, opensAt? }`.
- `isOpenUntil(structured, coords, hhmm, date)` -> boolean. Conservative: `unknown` / `notam` never count as open.

### Timezone: UTC (Zulu)

AIP AD 2.3 hours are published in **UTC** (ICAO Annex 15), and pilots plan in UTC, so the feature is UTC throughout: the map "open until 19:00" input is 19:00 **UTC** (labelled "UTC" next to the picker), and the detail-page badge marks its times with `Z` ("closes 19:00Z"). `openStatus`/`isOpenUntil` compute the day-of-week and minute-of-day in UTC. Sub-caveat: the common `0600-2200 (0500-2100)` AIP form (winter UTC, summer UTC in parentheses) is stored as the first/winter value, so a field can read 1h off during local summer time - acceptable under the advisory framing ("confirm via NOTAM / current AIP"), and DST-aware selection is a possible future refinement.

## Surfaces

### 1. Detail-page status badge (advisory)

In `airport-gadgets.tsx` (which already resolves coords + facts) / `airport-facts.tsx`, compute `openStatus(...)` for the field's local "now" and render next to the existing hours row: **"Open now - closes 19:00"**, **"Closed - opens 08:00"**, or nothing when `unknown`. A small advisory line ("times are advisory - confirm via NOTAM / current AIP") and a source hint ("per AIP AD 2.3" vs "community data") accompany it.

### 2. Airport JSON-LD `openingHoursSpecification` (SEO/GEO)

Upgrade the current free-text "Opening hours" `additionalProperty` to the canonical schema.org shape: an `openingHoursSpecification` array of `OpeningHoursSpecification { dayOfWeek, opens, closes }` on the `Airport` node, generated from `hours_structured`. Consecutive identical days are grouped; `h24` -> `00:00`..`23:59`; `sunrise`/`sunset`/`notam`/`unknown` days are **omitted** (schema.org has no solar primitive and we do not assert unverified windows). The free-text PropertyValue stays as a fallback for `remarks`-only fields. Machine-readability win for LLMs and search engines; no Google rich-result dependency.

### 3. Map: "Operating hours" tab + filter

The airport-list map (`airport-map.tsx`) grows a small tabbed control area:

- **Tab 1 "Filters"** - the existing fuel / customs / paved pills (unchanged).
- **Tab 2 "Operating hours"** - an **"Open now"** quick toggle and an **"Open until [time]"** time input (default 19:00). Both evaluate `isOpenUntil` / `openStatus` client-side over the markers and redraw the Leaflet layer group (never tear down map/tiles), AND-combined with any active boolean filters.

The tab appears only when >=1 marker carries structured hours. The structured hours are emitted per marker from `airport-coords/route.ts` (selecting `hours_structured` in `airportsWithCoords`), so the client evaluates any chosen time with no round trip; fail-soft, omitted when absent.

### 4. eAIP AD 2.3 authoritative fallback (crawlers)

For the eurocontrol eAIP countries (`HttpEurocontrolBase` roster - NL, UK, FR, BE, CZ, PL, SE, ...):

- `crawlers/crawlers/operating_hours.py` - a pure normalizer (Python twin of the TS module, shared test vectors) that tokenizes AD 2.3 free text into the same 7-day JSON. `H24` -> all-day; `MON-FRI 0800-1700` (and day-range variants) -> fixed windows; `SR-SS` -> sun flags; `O/R`, `HO`, `PPR`, unrecognized -> `unknown` (never guessed). Fail-soft to no-hours.
- `ad23_hours(page_text)` on `http_eurocontrol_base.py` - locates the AD 2.3 section and **isolates ROW 1** (the "AD operator / administration" row = the aerodrome's own hours). Two design points make this generic across producers:
  - **Row-1 isolation**: AD 2.3 is a multi-row ICAO table and the later rows (AIS / ARO briefing offices) are frequently **centrally H24**, so a naive slice reads a false H24 for a small field. Row 1 is cut at the **row-2 number marker `" 2 "`** or the first English service-row label ("Customs and immigration", ...), whichever comes first. The number marker is language- and layout-independent (it also survives FI's bilingual "label-after-value" layout). If row 1 cannot be isolated, it returns `null` (no assertion) - a wrong "open" is worse than none.
  - **Language-agnostic section match**: the matcher anchors on the ICAO section number **`AD 2.3`** (not the English "OPERATIONAL HOURS" heading, which is translated on native pages, e.g. SIA/FR "HEURES DE FONCTIONNEMENT"), and walks every `AD 2.3 ... (next AD 2.x)` block, returning the first that yields row-1 hours - so a table-of-contents entry (no hours) is skipped in favour of the real section. This unlocks non-English pages (FR) while staying a strict superset of the English behaviour.
- `collect_ad23_hours(airports)` fetches each field's AD 2 page (one extra HTTP GET per field, reusing the crawler's own client so proxy / CA / legacy-TLS config carries over) and, when the primary page has no isolatable AD 2.3, tries ordered fallbacks: a **section-1 URL rewrite** (multi-page NL/SE-style eAIPs keep charts on section N and AD 2.3 on section 1) and an **English-locale swap** (`-fr-FR` -> `-en-GB`).
- The eAIP crawler POSTs the structured hours to the existing **`POST /api/airport-facts`** (upsert-by-ICAO) with `hoursSource: "eaip"`, landing official hours in `airport_facts.hours_structured` without touching the `airports` write path.

Non-eurocontrol sources (DE / ES / GR / CIS info-pages) have no eAIP AD 2.3 HTML and keep OpenAIP-only. The collection runs for **every** eurocontrol country from `main.py` (guarded by `isinstance(crawler, HttpEurocontrolBase)`); per-country quirks fall into the `unknown` bucket and fall back to OpenAIP, they never block or emit wrong hours.

### Rollout validation (live, `crawler-live-test.yml`)

Validated live per country (AD 2.3 fields collected / total; the rest fall back to OpenAIP):

| Country | Collected | Note                                                                          |
| ------- | --------- | ----------------------------------------------------------------------------- |
| UK      | 111/122   | standard English eAIP                                                         |
| PL      | 0/69      | AD-4 VFR-manual pages carry no AD 2.3 section -> OpenAIP                      |
| FR      | 71/143    | French SIA pages, unlocked by the language-agnostic match (0/143 before it)   |
| FI      | 24/40     | bilingual "label-after-value"; the `" 2 "` marker keeps the rest safe-unknown |
| NL      | 18/24     | reference country (EHBD 06:00-22:00, EHAM H24)                                |
| IE      | 20/22     |                                                                               |
| KZ      | 23/27     |                                                                               |
| GE      | 7/7       |                                                                               |
| SI      | 0/16      | un-isolatable layout -> OpenAIP (safe)                                        |
| MK      | 0/2       | -> OpenAIP (safe)                                                             |

The pattern holds: standard eurocontrol eAIPs collect the large majority of fields; deviating producers (portal-reference, AD-4-only, or un-isolatable) fall back to OpenAIP with **no** false "open". EHBD/EHAM were the reference recon (run 29685082575).

### DE (Germany, ~792 fields) - recon dead-end, NOT structured-extractable via httpx

DE is the single largest coverage lever, but DFS **BasicVFR/BasicIFR is not ICAO AD 2.3**, so `ad23_hours()` never applied. A dedicated two-round live recon (temporary `de.py` debug, since DFS is unreachable from the sandbox) confirmed the source is a dead-end for httpx:

- Round 1 - the per-field permalink chapter pages (`.../BasicVFR/<AIRAC>/pages/C<NNNNN>.html`) are **navigation shells**: title + ICAO + `myPermalink` only, no operating-hours text.
- Round 2 - followed each page's `a.document-link` to the aerodrome **data sub-documents** (`.../pages/<HASH>.html`). For all three probed fields (EDKA, EDPA, EDXA) and both sub-documents each, the extracted text was a **764-793 char DFS "Permanent Link" boilerplate shell** - every keyword probe (`Betriebszeit`, `Flugbetrieb`, `Operating`, `PPR`, `H24`, `HX`, `SR`) returned no match.

The actual AD 2 aerodrome data is **client-rendered (JS)** and absent from the static HTML httpx retrieves. So DE hours are **not extractable via httpx** - a `PlaywrightCrawlerBase` render would be needed for ~792 fields per crawl (heavy). Per the plan's decision gate, **structured DE hours are documented as not-extractable and left to the OpenAIP/OSM fallbacks**, not built. The DE fields keep the honest `Weather.hoursNone` note where no source has hours.

### DE Phase F (19.07.2026) - AD-2 pages are base64 PNG images; OCR ships as DISPLAY-only text

A follow-up render recon settled what the "client-rendered" AD-2 body actually is: **DFS serves each AD-2 book page as a base64-embedded PNG image** (`<img src="data:image/png;base64,...">`), not text - the rendered DOM's `get_text()` returns only ~784 chars of page chrome; the hours / Platzrunde / etc. are pixels. So no text parser (httpx or Playwright) can read them; the sole route to any DE AD-2 datum is **OCR**.

The owner approved a **narrow** OCR build (Phase F2) under a strict safety constraint: **raw display text only, never a structured claim.** What shipped:

- **`crawlers/crawlers/de_ocr.py`** - `biggest_png()` (the full AD-2 scan is the largest embedded PNG), `ocr_image()` (lazy `pytesseract` + `Pillow`, `lang="deu+eng"`, fail-soft), and `is_text_page()` - a text-vs-chart discriminator (a **chart** page carries the aerodrome reference coordinates `N .. E ..` in its head, or a chart-title marker; only dense **text** pages are kept). So only the ~40 big Verkehrsflughaefen with a typeset text sheet yield anything; the ~750 chart-only fields OCR to noise and are dropped.
- **`de.py collect_ad2_ocr(airports)`** - opt-in via the `DE_OCR` env flag (never the daily list crawl; heavy - a browser render per field, narrowable with `DE_OCR_ICAOS`/`DE_OCR_LIMIT`). Renders each field's leaf landing, follows the `<ICAO> <n>` content-page links, OCRs each page's PNG, keeps the text pages, stores the concatenation in `self.ad2_text_by_icao[icao]`. Published via `OutputHandler.publish_ad2_text` (PATCH `/api/airport-facts`, source `dfs-ocr`) into the new `ad2_ocr_text` column.
- **Website** - a **DE-only display block** (`airport-aip-text.tsx`, rendered by the gadgets wrapper) shows the raw text under a **prominent, always-visible caveat** ("read by text recognition, verify against the current AIP") and a link to the official DFS page. It is **NEVER** parsed into `hoursStructured`, the open/closed badge, the map's operating-hours filter, or the Airport JSON-LD - a mis-OCR'd digit must not become a machine claim under the "never assert a wrong open" rule. The public `/api/v1` also does not expose it.

### DE follow-up (20.07.2026) - owner reversal: OCR hours now go NATIVE, under a disclaimer

The owner subsequently decided (with the OCR-garble risk spelled out and a stricter validator gate offered and declined) to take the DE hours **native**: the AD 2.3 operating hours are now parsed out of the OCR text and drive the same open/closed badge, map Open-hours filter and `openingHoursSpecification` JSON-LD as every eAIP country, with a **small always-visible disclaimer** next to them as the honesty backstop. The raw display block (`airport-aip-text.tsx`) stays. What this added:

- **`crawlers/crawlers/de_hours.py`** - `parse_de_hours(text)`: slices the AD 2.3 aerodrome-operator row out of the OCR blob, normalises the DFS/OCR quirks (summer/winter dual times `0500 (0400)` -> keep the first; comma day-lists `SAT, SUN, HOL` -> per-day segments, HOL dropped; `SS+030`/`MAX 1900` solar tails -> bare `SS`; OCR dash/equals glyphs), and delegates to the shared `operating_hours.parse_ad23_text` so DE lands in the identical 7-day shape. Fail-soft: an unreadable row yields `None` (no hours, no badge).
- **`de.py collect_ad2_ocr`** also fills `self.hours_by_icao[icao]` from `parse_de_hours`; **`main.py`** publishes it in the `DE_OCR` block via `OutputHandler.publish_hours(..., hours_source="dfs-ocr-hours")` (the source param added to `publish_hours`, default still `"eaip"`).
- **Website** - `hours_source` gains `"dfs-ocr-hours"` in the API PATCH enum and the `hoursRank` precedence CASE (rank 3: AIP-derived, above community `openaip`/`osm`, below authoritative `eaip`). `airport-facts.tsx` shows the parsed weekly schedule line (`structuredHoursToDisplay`), a `hoursOcr` source label, and the `hoursOcrDisclaimer` note. The badge / map filter / JSON-LD are all source-agnostic and light up automatically. The source value `"dfs-ocr-hours"` is deliberately distinct from `ad2OcrSource="dfs-ocr"` (the raw display text) so provenance stays separable.

Backstops for the OCR-driven claim: `parse_ad23_text` returns `None`/`unknown` for anything it cannot confidently read (no badge on a bad read), and the `hoursOcrDisclaimer` is always visible next to the hours.

## Deployment / migration hazard

Adding `hours_structured` + `hours_source` needs a D1 migration. Per the project's known hazard, the Cloudflare **Git integration deploys branch pushes without applying D1 migrations** - only `cd.yml` on push-to-`main` runs `wrangler d1 migrations apply DB --remote`. So the migration must be applied to remote D1 **manually before/at branch-push time** and recorded in `d1_migrations` (the `0007_airac` precedent), otherwise a branch deploy runs new code that reads a missing column. All reads stay fail-soft, so a missing column degrades to "no hours", never a 500.

## Out of scope (documented, not built)

- A **dedicated cross-country query page** ("find airfields open until X") under the `(search)` route group.
- A **`/api/v1` filter param** for opening hours (the single-airport `/api/v1/airport/{ICAO}` already exposes `openingHours`).

Both reuse the same structured column and logic; they are a natural follow-up once the data has coverage.

## Verification

- `pnpm check` + `pnpm test` (vitest) - `opening-hours.ts`: fixed windows, SR/SS resolution at a known lat/lon/date, H24, NOTAM->unknown, `isOpenUntil` boundary at exactly 19:00.
- `pytest` - `operating_hours.py` mirrors the TS vectors.
- eAIP recon - `crawler-live-test.yml` against NL confirms `ad23_hours` extraction, then a second eurocontrol country.
- Manual - `import_openaip_backfill.py` dry-run confirms `hours_structured` JSON; confirm eAIP is not overwritten by a later OpenAIP run; local `pnpm start` shows the badge + source label and the map "open until 19:00" filter drops fields closing earlier and excludes unknown-hours fields; validate `openingHoursSpecification` in the schema.org validator; the e2e JSON-LD test still passes.
- i18n parity (`scripts/check-i18n.mjs`) passes with the new keys in every locale.
