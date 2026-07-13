# AIP:Aero - Pilot Wishlist & Improvement Roadmap

_Written from the seat of an international PPL who flies a piston single (SEP) across Europe -
the target user of this site. Created 2026-07-08, kept updated as items ship._

## What AIP:Aero is today (and why it's good)

AIP:Aero is a fast, clean, multilingual **link directory** for national Aeronautical Information
Publications. The flow is: pick a country - pick a category (VFR / IFR / heliport / militaire /
aéroport) - type an airport name or ICAO - get **one outbound link to the official approach chart**.

That is genuinely useful. The national AIS "basic" versions (DFS BasicVFR, NATS, Austro Control,
LVNL, SIA, ...) publish the charts for free but give you **no search** - you page through AD sections by
hand. AIP:Aero fixes exactly that, now in **12 countries** (AT, DE, FR, NL, UK, BE/LU, CZ, DK, GR, NO,
PL, SE) across 22 locales, and its SEO is strong (per-airport pages, JSON-LD, multilingual sitemap).

The database is still deliberately thin - per airport it stores only six fields (`icao, title, url,
type, country, slug`, `src/server/db/schema.ts`), and the crawlers emit only those. Operational data
is not stored; where a gadget needs it (weather), it is fetched **server-side at request time** from a
free API and cached, never persisted. Still missing in-app: ~~coordinates for all fields~~, ~~a map~~,
**NOTAMs**, ~~runway/frequency~~/~~customs~~ data, ~~favorites~~.

The rest of this document is what I, as the pilot, still wish it did - and what has shipped so far.

---

## A. Wishlist - what I want when I look up a field

- ~~**Aerodrome facts card**: elevation, runways, **frequencies**, **opening hours** and a **postal
  address / coordinates / contact phone** - **shipped** (§C), embedded server-side from OpenAIP +
  OurAirports (CC0) + AWC/NOAA + OpenStreetMap. Fuel (AVGAS / JET-A1), PPR flag and circuit direction
  now render on the card too (OpenAIP, verified against its authoritative v1 schema).~~ Still wished
  for: **how to request PPR** (contact / procedure).
- ~~**Crosswind / headwind component** per runway from the reported wind, with a compass diagram -
  **shipped** (§C).~~
- ~~**Customs / Airport-of-Entry** flag + national border-crossing form links (UK **GAR**, etc.) -
  **shipped** (§C): the customs flag renders on the contact box (OpenAIP), and verified national
  border-crossing form links render per country (`src/lib/border-crossing.ts`; UK GAR first).~~
  Still wished for: form links for further countries as they are verified.
- ~~**Weather**: decoded **METAR / TAF** with a per-report decode tab, plus sunrise / sunset + civil
  twilight (VFR night) - **shipped** (§C).~~
- ~~**Map + "airports near me"** (OpenStreetMap tiles) - **shipped** (§C): a Leaflet map on the
  airport-list page with a "locate me" button, now with **filters** for fuel / customs / paved
  runway (facts-driven toggles).~~
- ~~**Deep link to the exact chart PDF** (+ inline preview) instead of the AIP index page - **partially
  shipped**: where the crawler URL already points at a PDF, the detail page shows a chart box with a
  direct "open PDF" link, a lazy on-click inline preview and DigitalDocument JSON-LD. The Stage-2
  plumbing (nullable `pdf_url` column + crawler model + API + display preference) is in place.~~
  Still wished for: the per-country crawler extraction of exact-PDF URLs for sources that store an
  index page (see `docs/chart-pdf-plan.md`; needs live-source validation on the runner).
- ~~**Chart currency indicator** - a "last updated" date shipped (§C); true per-country AIRAC freshness
  now shipped too (a real per-country crawl timestamp via the `crawl_meta` table).~~
- ~~**Favorites / recently viewed** (localStorage - no account needed) - **shipped** (§C): favorites
  are the offline-saved fields (one implementation, per the PWA concept), recents are tracked on
  detail-page views; both listed on the country landing page.~~
- ~~**Cross-country unified search** - one box across every country - **shipped** (§C).~~
- **More countries**: CH, IT, ES, ... beyond the current 12.
- **EFB / tool hand-offs**: deep links to SkyDemon, ForeFlight, autorouter, Windy, OpenAIP, national
  self-briefing / AIS. (A Google Maps link per field already shipped, §C.)

---

## B. Space for improvements - quality of what already exists

| Area | Issue | Where |
| --- | --- | --- |
| ~~Search scope~~ | ~~Per-country search matches `title`/`icao` only; a cross-country global search now exists on the root~~ **done** | `server/actions.ts`, `queries.ts` |
| ~~Coordinates~~ | ~~Stored per ICAO in `airport_facts` (OurAirports importer); resolved at request time when absent~~ **done** | `server/db/schema.ts` |
| ~~Security~~ | ~~CSP still in Report-Only mode~~ **enforced** (AdSense + adtrafficquality origins allowlisted, `object-src https:` for the chart-PDF embeds) | `next.config.mjs` |

Note: the Product-schema `aggregateRating` (4.9 / 247) is a **deliberate SEO choice the owner wants
kept** - left as-is on purpose.

---

## C. Shipped

**UX / performance / navigation batch 2026-07-12 (afternoon, PRs #197-#209).** **Country bulk
download** (PWA Phase 4, `save-country-offline-button.tsx`): all of a country's detail pages saved
for offline use from the airport-list page (HTML-only, quota-guarded, progress/cancel/update/remove),
plus a localized scope hint stating what IS and is NOT included (chart PDFs stay per-field, live
weather needs a connection). **Airport-list card** on every country landing page (localized href,
description names the offline download / customs / fuel features). **Navigation rebuilt for
performance + SEO**: both menus server-rendered (zero Menu messages to the client), the mobile menu
is a horizontally scrollable pill bar (SSR links, one less tap), the language switcher is two plain
crawlable links (Radix Select removed), the airport-list rows are plain `<a>` - net -43 kB First
Load JS on the homepage and three dependencies removed (vaul, @radix-ui/react-select,
class-variance-authority). **Breadcrumb** scrolls horizontally instead of wrapping (CLS guard) and
carries localized aria-labels; header logo + navs got localized, keyword-rich titles/labels.
Verified live: Lighthouse 97-100 across all four categories on homepage, landing, list and detail
pages.

**Wishlist batch 2026-07-12.** **Favorites / recently viewed** (favorites = the offline-saved
fields via the existing `aip-offline-saved` index, recents tracked client-side in
`aip-recently-viewed`; both rendered as a client-only section at the bottom of the country landing
page - below the fold, so the indexable SSR content and CLS/LCP stay untouched). **Map filters**
(fuel / customs / paved runway) on the airport-list Leaflet map - facts-driven boolean flags computed
server-side in `/api/airport-coords`, AND-combined toggles in the map's existing control row,
markers redrawn in a layer group (no map/tile teardown per toggle). **Border-crossing form links**
(`src/lib/border-crossing.ts` - verified official links only; UK GAR on every UK detail page's
contact box). **Chart-PDF Stage-2 plumbing** (`pdf_url` column + crawler model + API + display
preference; per-country extraction still open, see `docs/chart-pdf-plan.md`). **CSP enforced**
(promoted from Report-Only; AdSense/adtrafficquality origins allowlisted up front, `object-src
https:` keeps the chart-PDF inline preview working).

**First batch (low-hanging fruits).** French live search fixed (`mil`/`aeroport` in the search enum);
ICAO column searched directly; the unused debounce wired up; mobile nav shows Aéroports & Militaire;
`Error` strings localized (German copy no longer leaks into EN/NL); France added to the SiteNavigation
schema; **PWA Web App Manifest** (installable on an EFB tablet); CZ/GR crawler-doc fixes.

**Trade:Aero cross-linking.** Locale + country aware deep links to the sister marketplace
(`tradeAeroUrl` in `src/lib/trade-aero.ts`), derived from the locale config so new countries roll out
automatically; a localized CTA on the country landing + airport-list pages; SEO/a11y optimized
(followed links, `title`/`aria-label`, WCAG 2.5.3 Label in Name); the footer link is locale-aware. See
`docs/trade-aero-crosslink-concept.md`.

**Weather + gadgets (server-side).**
- **METAR / TAF gadget** on every airport detail page (`src/components/airport-weather.tsx`,
  `src/lib/weather.ts`): raw METAR + TAF plus a decoded summary (wind, visibility, clouds, temp, QNH),
  the VFR/MVFR/IFR/LIFR flight-category badge and the observation time. Fetched server-side from the
  NOAA / Aviation Weather Center API (free, no key), cached ~10 min, fail-soft.
- **Google Maps link** to the field (`src/components/airport-gadgets.tsx`) - a plain outbound link
  resolving the field by ICAO/name query (no stored coordinates needed).
- **"Last updated"** indicator on the charts index (`src/components/last-updated.tsx`), now backed by a
  **real per-country crawl timestamp** (`crawl_meta` table + `QUERIES.crawlUpdatedAt`), not just the
  build date.
- **Aerodrome facts** (`src/components/airport-facts.tsx`, `src/lib/airport-facts.ts`): embedded
  runways / frequencies / elevation / opening hours per ICAO, merged from **three** sources by a
  per-field precedence: **OpenAIP** when `OPENAIP_API_KEY` is set (`src/lib/openaip.ts`, richest, the
  only source of fuel / PPR / hours / circuit), the **OurAirports** base (CC0, imported into D1 by
  `crawlers/import_ourairports.py`; the only source of town / website), and **AWC / NOAA**
  (`src/lib/awc-airport.ts`, the free no-key `aviationweather.gov` "airport" endpoint) as an
  **always-on fallback** for coordinates / elevation / runways / frequencies. So even small VFR fields
  now show data with no importer run and no key. Content is embedded, not linked out.
- **Wind components** (`src/components/airport-wind.tsx`, `src/lib/crosswind.ts`): per-runway
  head/tail- and cross-wind from the field's own reported wind and the runway bearings, with a
  server-rendered compass SVG (runways + wind arrow, no client JS). Skips VRB winds / fields with no
  runways.
- **Weather decode tab** (`src/lib/metar-decode.ts`): each raw METAR/TAF expands (native `<details>`,
  SSR, no client JS) into plain-language lines via a built-in multilingual glossary.
- **Sunrise / sunset + civil twilight** (`src/lib/sun-times.ts`): computed locally (no API) from the
  field coordinates, shown in the aerodrome-data box.
- **Contact / location box** (`src/components/airport-contact.tsx`, `src/lib/geocode.ts`): postal
  address (street / postcode / town), coordinates and contact phone, reverse-geocoded from
  **OpenStreetMap (Nominatim)** using the best available coordinates (facts row, else METAR station),
  cached + fail-soft.
- **Map + "airports near me"** (`src/components/airport-map.tsx`): a Leaflet + OpenStreetMap map on the
  airport-list page plotting every chart-linked field with coordinates, popups linking to the detail
  page, and a geolocation "locate me" button. Leaflet runs client-side only; the SSR airport list is
  the indexable no-JS fallback. Only rendered when the facts importer has populated coordinates.
- **Cross-country search** on the root page (`src/components/global-search-input-field.tsx`).
- **Sitelinks Search Box** (`WebSite` `SearchAction` JSON-LD on the root, executed via the site's
  valueless `?<term>` query-key scheme) so Google may surface a search box under the aip.aero result.
- **Crawler reach**: JS-rendering fallback (`PlaywrightCrawlerBase`, DK) + Bright Data Web Unlocker
  wiring (GR) so the last two blocked national sources can be crawled once their host prerequisites are
  set (browser install / unlocker zone).

---

## D. Missing services & integrations - the roadmap

**Hard constraint on every info gadget: server-side rendered (SSR)** (Cloudflare Workers), so content +
SEO metadata land in the served `<head>`/`<body>`. Simple links (airport website, Google Maps) are the
only exception - plain outbound links, no server data. Any interactive layer (map) hydrates over an
SSR'd, indexable fallback.

### 1. More countries + unified cross-country search - effort M, no schema change
~~Add an all-country search alongside the per-country one~~ **(shipped, §C)**. Still open: ship further
countries (inherit `HttpCrawlerBase` / `HttpEurocontrolBase` / `PlaywrightCrawlerBase`, no Selenium);
seed endpoints from **EUROCONTROL AIS online** (https://www.eurocontrol.int/articles/ais-online).
Prioritize countries with the strongest Trade:Aero market activity for cross-sell synergy.

### 2. ~~Aerodrome facts card + map~~ - **shipped**
~~Facts (elevation / runways / frequencies / opening hours) merge OurAirports (CC0) + OpenAIP; the map
(§C) uses Leaflet + OpenStreetMap tiles with the SSR airport list as the fallback.~~ OpenAIP caveat still
stands for the optional enrichment: community-sourced, needs a key, licence typically **non-commercial
(CC BY-NC-SA)** - clear before an AdSense-funded launch. ~~Still open on top of this: fuel / PPR /
circuit direction, map filters, customs flags~~ - all shipped (§C); customs sourcing beyond OpenAIP
(AIP GEN 1.2 / national data) remains a possible refinement.

### 3. ~~Sunrise / sunset + civil twilight (VFR night)~~ - **shipped**
~~`src/lib/sun-times.ts` computes rise/set + civil twilight locally (no key, server-side) from the field
coordinates (facts row, else the METAR station), shown in the aerodrome-data box.~~

### 4. Still open - the remaining roadmap
- ~~**Fuel / PPR / circuit direction** on the facts card (OpenAIP).~~ **(shipped - fuel, PPR, opening
  hours and circuit direction render on the facts card; field names + enums verified against OpenAIP's
  authoritative public v1 schema, unit-tested in `openaip-parse.test.ts`.)** Still open: **how to
  request PPR** (contact).
- ~~**Deep link to the exact chart PDF** (+ optional inline preview).~~ **(partially shipped - chart
  box with direct PDF link, lazy on-click preview and DigitalDocument JSON-LD wherever the stored URL
  is already a PDF.)** Still open: exact-PDF URLs for index-page countries (`docs/chart-pdf-plan.md`).
- ~~**Per-country AIRAC / crawl freshness** - a real per-country crawl timestamp.~~ **(shipped -
  `crawl_meta` + `QUERIES.crawlUpdatedAt`.)**
- ~~**Customs / Airport-of-Entry** flag + national border-crossing forms.~~ **(shipped - customs flag
  on the contact box; verified form links via `border-crossing.ts`, UK GAR first.)** Still open:
  verify + add form links for further countries.
- ~~**Favorites / recently viewed** (localStorage).~~ **(shipped.)**
- **More countries** (CH, IT, ...). ES shipped 13.07.2026 with Europe expansion batch 1.
- ~~**Enforce CSP**.~~ **(shipped - enforcing `Content-Security-Policy` in `next.config.mjs`.)**
- **Real screenshots on the EFB guide** (postponed 13.07.2026, owner decision): compressed WebP
  captures of the save button, offline banner and country download once the UI is stable - the
  schematic icon mockups cover the need until then.
- **NOTAMs on the detail pages via the autorouter API** (owner request 13.07.2026). autorouter is
  the only one of our EFB hand-off partners with a documented free API (account/OAuth) that serves
  NOTAMs - the one briefing datum we are missing entirely. Before building: verify the API's terms
  of use and attribution requirements from the runner (same verified-only policy as the
  border-crossing links), then design auth flow, caching (NOTAMs are time-critical - short TTL,
  never silently stale, like the weather box) and fail-soft rendering. NOTE: the autorouter
  hand-off LINK was removed 13.07.2026 - `/airport/<ICAO>` renders "page not found" even
  logged-in (a soft-404 that a status-code check had let through); a deep link may return
  alongside the API integration once a content-verified pattern exists.
