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
free API and cached, never persisted. Still missing in-app: **coordinates for all fields, a map, NOTAMs,
runway/frequency/customs data, favorites**.

The rest of this document is what I, as the pilot, still wish it did - and what has shipped so far.

---

## A. Wishlist - what I want when I look up a field

- **Aerodrome facts card**: elevation, runways and **frequencies** - **shipped** (§C), embedded
  server-side from OurAirports (CC0) + OpenAIP. Still wished for: circuit direction, **fuel**
  (AVGAS / JET-A1), PPR flag + how to request it, opening hours.
- **Customs / Airport-of-Entry** flag + national border-crossing form links (UK **GAR**, etc.).
- **Weather**: decoded **METAR / TAF** - **shipped** (§C). Sunrise / sunset + civil twilight (VFR night)
  for stations that report coordinates - **next** (§D.3).
- **Map + "airports near me"** (OpenStreetMap tiles), filter by fuel / customs / hard runway.
- **Deep link to the exact chart PDF** (+ inline preview) instead of the AIP index page.
- **Chart currency indicator** - a "last updated" date shipped (§C); true per-country AIRAC freshness
  still needs a crawl timestamp.
- **Favorites / recently viewed** (localStorage - no account needed).
- **Cross-country unified search** - one box across every country instead of one per locale.
- **More countries**: CH, IT, ES, ... beyond the current 12.
- **EFB / tool hand-offs**: deep links to SkyDemon, ForeFlight, autorouter, Windy, OpenAIP, national
  self-briefing / AIS. (A Google Maps link per field already shipped, §C.)

---

## B. Space for improvements - quality of what already exists

| Area | Issue | Where |
| --- | --- | --- |
| Search scope | Country-siloed (one country per locale); matches `title`/`icao` only | `server/actions.ts`, `queries.ts` |
| Airport "detail" | Beyond the chart link + weather, still no static facts (elevation/runways/freqs) | `(search)/*/page.tsx` |
| Coordinates | Not stored; only available for fields with a NOAA METAR station | `server/db/schema.ts` |
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
- **"Last updated"** indicator on the charts index (`src/components/last-updated.tsx`).
- **Aerodrome facts** (`src/components/airport-facts.tsx`, `src/lib/airport-facts.ts`): embedded
  runways / frequencies / elevation per ICAO, merged from the **OurAirports** base (CC0, imported into
  D1 by `crawlers/import_ourairports.py`) and **OpenAIP** when `OPENAIP_API_KEY` is set
  (`src/lib/openaip.ts`, fail-soft). Content is embedded, not linked out. Renders nothing until the
  importer has run / a key is set.
- **Cross-country search** on the root page (`src/components/global-search-input-field.tsx`).

---

## D. Missing services & integrations - the roadmap

**Hard constraint on every info gadget: server-side rendered (SSR)** (Cloudflare Workers), so content +
SEO metadata land in the served `<head>`/`<body>`. Simple links (airport website, Google Maps) are the
only exception - plain outbound links, no server data. Any interactive layer (map) hydrates over an
SSR'd, indexable fallback.

### 1. More countries + unified cross-country search - effort M, no schema change
Ship further countries (inherit `HttpCrawlerBase` / `HttpEurocontrolBase`, no Selenium); seed endpoints
from **EUROCONTROL AIS online** (https://www.eurocontrol.int/articles/ais-online). Add an all-country
search alongside the per-country one. Prioritize countries with the strongest Trade:Aero market activity
for cross-sell synergy.

### 2. Aerodrome facts card + map - needs a data source
Elevation, runways, frequencies, and coordinates for **all** fields need an external database, since our
own DB is intentionally minimal. **OpenAIP** (https://www.openaip.net/docs, https://github.com/openAIP)
offers third-party APIs and is the natural candidate, **but**: its data is community-sourced (not
authoritative), the API needs a key, and the licence is typically **non-commercial (CC BY-NC-SA)** -
which must be cleared for an AdSense-funded site before use. With coordinates in hand, render a map with
**Leaflet + OpenStreetMap tiles** (SSR fallback = nearby-airports list). Customs / Airport-of-Entry
flags come from AIP GEN 1.2 / national data.

### 3. Sunrise / sunset + civil twilight (VFR night) - effort S, no key
For fields that report a METAR, the NOAA response already includes `lat`/`lon`/`elev`. Derive field
elevation and sun times (a self-contained solar calculation, no dependency, server-side) - a cheap
extension of the existing weather gadget. Full coverage still waits on D.2 coordinates.
