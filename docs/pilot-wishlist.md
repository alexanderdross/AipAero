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
**NOTAMs**, ~~runway/frequency~~/**customs** data, **favorites**.

The rest of this document is what I, as the pilot, still wish it did - and what has shipped so far.

---

## A. Wishlist - what I want when I look up a field

- ~~**Aerodrome facts card**: elevation, runways, **frequencies**, **opening hours** and a **postal
  address / coordinates / contact phone** - **shipped** (§C), embedded server-side from OurAirports
  (CC0) + OpenAIP + OpenStreetMap.~~ Still wished for: circuit direction, **fuel** (AVGAS / JET-A1),
  PPR flag + how to request it.
- **Customs / Airport-of-Entry** flag + national border-crossing form links (UK **GAR**, etc.).
- ~~**Weather**: decoded **METAR / TAF** with a per-report decode tab, plus sunrise / sunset + civil
  twilight (VFR night) - **shipped** (§C).~~
- ~~**Map + "airports near me"** (OpenStreetMap tiles) - **shipped** (§C): a Leaflet map on the
  airport-list page with a "locate me" button.~~ Still wished for: filter by fuel / customs / hard runway.
- **Deep link to the exact chart PDF** (+ inline preview) instead of the AIP index page.
- ~~**Chart currency indicator** - a "last updated" date shipped (§C); true per-country AIRAC freshness
  now shipped too (a real per-country crawl timestamp via the `crawl_meta` table).~~
- **Favorites / recently viewed** (localStorage - no account needed).
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
| Security | CSP still in Report-Only mode (not enforced) | `next.config.mjs` |

Note: the Product-schema `aggregateRating` (4.9 / 247) is a **deliberate SEO choice the owner wants
kept** - left as-is on purpose.

---

## C. Shipped

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
  runways / frequencies / elevation / opening hours per ICAO, merged from the **OurAirports** base
  (CC0, imported into D1 by `crawlers/import_ourairports.py`) and **OpenAIP** when `OPENAIP_API_KEY`
  is set (`src/lib/openaip.ts`, fail-soft). Content is embedded, not linked out.
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
(CC BY-NC-SA)** - clear before an AdSense-funded launch. Still open on top of this: **fuel (AVGAS /
JET-A1), PPR flag + contact, circuit direction** (all best-effort from OpenAIP), map **filters**, and
**customs / Airport-of-Entry** flags from AIP GEN 1.2 / national data.

### 3. ~~Sunrise / sunset + civil twilight (VFR night)~~ - **shipped**
~~`src/lib/sun-times.ts` computes rise/set + civil twilight locally (no key, server-side) from the field
coordinates (facts row, else the METAR station), shown in the aerodrome-data box.~~

### 4. Still open - the remaining roadmap
- **Fuel / PPR / circuit direction** on the facts card (best-effort OpenAIP).
- **Deep link to the exact chart PDF** (+ optional inline preview) instead of the AIP index page.
- ~~**Per-country AIRAC / crawl freshness** - a real per-country crawl timestamp.~~ **(shipped -
  `crawl_meta` + `QUERIES.crawlUpdatedAt`.)**
- **Customs / Airport-of-Entry** flag + national border-crossing forms.
- **Favorites / recently viewed** (localStorage).
- **More countries** (CH, IT, ES, ...).
- **Enforce CSP** (currently `Content-Security-Policy-Report-Only`).
