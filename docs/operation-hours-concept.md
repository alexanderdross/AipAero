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

## Safety framing (owner directive)

Hours are shown as **advisory** - clearly labelled "confirm via NOTAM / current AIP before flight". Fields whose status is **unknown / by NOTAM / on-request (O/R)** are **excluded from "open" results** rather than guessed. This mirrors the project's existing "no best-effort entries" rule for customs and border-crossing links: a wrong "open" answer is a safety/operational hazard.

## Data model

A new structured, queryable column on `airport_facts`, kept **alongside** the human-readable `opening_hours` string:

- **`hours_structured` (TEXT, JSON)** - 7 entries (index 0 = Monday .. 6 = Sunday), each `{ open, close, flag }`:
  - `open` / `close` are **minutes after local midnight** (0..1439), or `null` for sun-relative / unknown days.
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
- `resolveDayWindow(day, coords, date)` - turn one `{ open, close, flag }` into concrete open/close **local** clock minutes for a given date, resolving `sunrise`/`sunset` via `getSunTimes` (converted from UTC to approximate local wall-clock, see caveat).
- `openStatus(structured, coords, when)` -> `{ state: "open" | "closed" | "unknown", closesAt?, opensAt? }`.
- `isOpenUntil(structured, coords, hhmm, date)` -> boolean. Conservative: `unknown` / `notam` never count as open.

### Timezone caveat

"19:00" is interpreted as the field's **local wall-clock**. Field local time is approximated from **longitude** (15deg = 1h), the same solar basis `sun-times.ts` already uses; it ignores political timezone boundaries and DST. This is acceptable under the advisory framing and is called out in the UI copy. A precise IANA-timezone lookup from coordinates is a documented future refinement.

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
- `ad23_hours(soup, icao)` on `http_eurocontrol_base.py` - locates the `<ICAO> AD 2.3 OPERATIONAL HOURS` section (stable anchor id/title, confirmed in saved NL page source) and reads the aerodrome operational-hours row.
- The eAIP crawler POSTs the structured hours to the existing **`POST /api/airport-facts`** (upsert-by-ICAO) with `hoursSource: "eaip"`, landing official hours in `airport_facts.hours_structured` without touching the `airports` write path.

Non-eurocontrol sources (DE / ES / GR / ...) keep OpenAIP-only. Roll out validated against **NL** first (reference page source exists) via `crawler-live-test.yml`, then the other eurocontrol countries inherit it. Per-country quirks fall into the `unknown` bucket, they do not block.

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
  </content>
  </invoke>
