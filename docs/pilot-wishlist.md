# AIP:Aero - Pilot Wishlist & Improvement Roadmap

_Written from the seat of an international PPL who flies a piston single (SEP) across Europe -
the target user of this site. Dated 2026-07-08._

## What AIP:Aero is today (and why it's good)

AIP:Aero is a fast, clean, multilingual **link directory** for national Aeronautical Information
Publications. The flow is: pick a country → pick a category (VFR / IFR / heliport / militaire /
aéroport) → type an airport name or ICAO → get **one outbound link to the official approach chart**.

That is genuinely useful. The national AIS "basic" versions (DFS BasicVFR, NATS, Austro Control,
LVNL, SIA) publish the charts for free but give you **no search** - you page through AD sections by
hand. AIP:Aero fixes exactly that, in 9 locales, and its SEO is strong (per-airport pages, JSON-LD,
multilingual sitemap). For "I know the field, give me the plate" it's the quickest tool there is.

**But** the data model is deliberately thin. Per airport the database stores only six fields -
`icao, title, url, type, country, slug` (`src/server/db/schema.ts`), and the crawlers emit only those
(`crawlers/crawlers/models.py`). There are **no coordinates, no weather, no NOTAMs, no
runway/frequency/customs data, no map, no favorites, no offline**. Everything operational lives on the
external chart the button links to. Five countries are live (AT, DE, FR, NL, UK); eight more are
specced in `crawlers/tasks/`.

The rest of this document is what I, as the pilot, wish it also did.

---

## A. Wishlist - what I want when I look up a field

When I'm planning a cross-border trip, the chart PDF is only half the job. Before I even open it I want
the **go/no-go essentials at a glance**, on the airport page itself:

- **Aerodrome facts card**: field elevation, runway(s) (identifier / length / surface / TORA-LDA),
  circuit direction, **frequencies** (TWR / INFO / ATIS / AFIS / APP), **fuel** (AVGAS / JET-A1),
  PPR flag + how to request it, published opening hours.
- **Customs / Airport-of-Entry**: a clear flag "customs available / AOE" plus the national
  border-crossing form links (UK **GAR**, etc.). When you fly DE→UK or into a Schengen edge this is the
  single most important fact, and today it's completely absent.
- **Weather**: decoded **METAR / TAF**, surface wind, and **sunrise / sunset + end of civil twilight**
  (VFR night) for the field. VFR go/no-go lives here.
- **Map + "airports near me"** (OpenStreetMap tiles): drop me on a map, show nearby fields, let me
  filter by fuel / customs / hard runway / open-now.
- **Deep link to the exact chart PDF** (and, ideally, an inline preview) instead of the AIP index page,
  so I land on the plate, not a table of contents.
- **AIRAC / last-updated indicator** on every airport link, so I trust the chart is current before I
  brief off it.
- **Favorites / recently viewed**: my home base and the fields I keep going back to, one tap away.
  No account needed - `localStorage` is enough.
- **Cross-country unified search**: I think "Kortrijk" or "EBKT", not "which country tab am I on".
  One search box that spans every country.
- **More countries**: CH, IT, ES, PL, CZ, BE/LU, DK, GR, NO, SE - the places I actually fly to.
- **Offline / installable (PWA)**: cache my favorite plates for the cockpit tablet; there's no signal
  at 3,000 ft.
- **EFB / tool hand-offs**: deep links to SkyDemon, ForeFlight, autorouter, Windy, OpenAIP and the
  national self-briefing (homebriefing / AIS) for the selected field.

---

## B. Space for improvements - quality of what already exists

These are rough edges in the current product, independent of new features:

| Area | Issue | Where |
| --- | --- | --- |
| Search scope | Country-siloed (one country per locale) and matched `title` only | `server/actions.ts`, `queries.ts` |
| French search | Live search on `/fr/military` & `/fr/aeroports` returned **0 results** (type enum rejected `mil`/`aeroport`) - **fixed, see §C** | `server/actions.ts` |
| Debounce | `useDebounce` helper existed but was unused → a server action per keystroke - **fixed, see §C** | `search-input-field.tsx` |
| Airport "detail" | Just a title + one button - no facts, no context | `(search)/*/page.tsx` |
| Mobile nav | Drawer omitted Aéroports & Militaire → French mobile users couldn't reach them - **fixed, see §C** | `mobile-menu.tsx` |
| Structured data | SiteNavigation node omitted France - **fixed, see §C** | `schemas/schema-sitenav.tsx` |
| PWA | No manifest / not installable - **fixed, see §C** | new `app/manifest.ts` |
| i18n | German error copy leaked into the English & Dutch locales - **fixed, see §C** | `messages/*.json` |
| Security | CSP still in Report-Only mode (not enforced) | `next.config.mjs` |
| Crawler docs | Copy-paste errors in the CZ & GR task specs - **fixed, see §C** | `crawlers/tasks/*` |

Note: the Product-schema `aggregateRating` (4.9 / 247) is a **deliberate SEO choice the owner wants
kept** - left as-is on purpose.

---

## C. Low-hanging fruits - shipped in this change

Small, self-contained fixes that respect the CLAUDE.md constraints (keep the `?ICAO` scheme, keep the
sitemap, `setRequestLocale` ordering, serverless runtime):

1. **French live search works** - added `mil` + `aeroport` to the search type enum
   (`src/server/actions.ts`).
2. **ICAO is searched directly** - the as-you-type query now matches `title` **or** `icao`
   (`src/server/db/queries.ts`); both columns are indexed.
3. **Debounce wired up** - one server action per settled keystroke burst instead of one per character;
   the prefilled ICAO on airport-detail pages no longer auto-submits (`src/components/search-input-field.tsx`).
4. **Mobile nav complete** - Aéroports & Militaire added to the mobile drawer, gated per locale by
   `t.has()` exactly like the desktop menu (`src/components/mobile-menu.tsx`).
5. **Error strings localized** - the `Error` namespace now shows English on `uk`/`*-EN`, Dutch on `nl`,
   French on `fr`, German on `de`/`at` (`messages/*.json`).
6. **France in the sitenav schema** - the hardcoded SiteNavigation node now names all five live
   countries (`src/components/schemas/schema-sitenav.tsx`).
7. **Installable (PWA)** - added a Web App Manifest so the site can be installed on an EFB tablet
   (`src/app/manifest.ts`).
8. **Crawler docs corrected** - fixed the copy-pasted country code in `crawler_czech.md` and the
   French airport / "Cartes relatives" examples in `crawler_greece.md`.

---

## D. Missing services & integrations - the roadmap

Prioritized in the order agreed with the owner. **Hard constraint on every item: server-side rendered
(SSR).** Data is fetched and HTML rendered on the server (Cloudflare Workers) so content + SEO metadata
land in the served `<head>`/`<body>` for crawlers - matching the existing pattern (`setRequestLocale`
before translations; `htmlLimitedBots: /.*/`; airport detail/lists are already SSR). Any interactive
layer (map pan/zoom, the search box) **hydrates on top of SSR'd content**, and the server always renders
a usable, indexable fallback (e.g. a server-rendered nearby-airports list beneath the map).

### 1. More countries + unified cross-country search - **effort M, no schema change**
Ship the `crawlers/tasks/` backlog and let search span every country instead of one per locale.
- **Crawlers**: each new country inherits `HttpCrawlerBase` / `HttpEurocontrolBase` (no Selenium), same
  as AT/DE/FR/NL/UK. Source index for discovering each nation's eAIP entry point:
  **EUROCONTROL AIS online** - <https://www.eurocontrol.int/articles/ais-online> (its EAD / AIS overview
  lists the national AIP endpoints to seed CH, IT, ES, PL, CZ, BE/LU, DK, GR, NO, SE …).
- **Search**: add a global (all-country) query alongside the existing per-country one, rendered
  server-side; keep results indexable. Fits the current architecture with no DB change.

### 2. Customs / border-crossing - **effort M, needs schema change**
The highest-value feature for international flying.
- Add a `customs` / airport-of-entry flag column (source: AIP GEN 1.2 and national customs data), plus a
  curated table of border-form links (UK GAR, etc.).
- Surface it on the airport page and as a search/list filter, all server-rendered.

### 3. Weather (METAR / TAF) - **effort S–M, no schema change**
- Per-airport decoded **METAR / TAF** + **sunrise/sunset & civil twilight**, fetched **server-side** from
  a free API (aviationweather.gov / NOAA ADDS, or DWD) keyed on the ICAO we already store.
- Cache on the Worker (short TTL, e.g. 10 min) so it stays cheap and SSR-friendly. No DB change.

### 4. Map + "near me" - **effort L, needs schema change**
- Pull **lat/lon** (and, opportunistically, runways/frequencies) from **OpenAIP open data** rather than
  scraping every AIP; store coordinates in new columns.
- Render with **Leaflet + OpenStreetMap tiles** (OSM specifically - not OpenAIP/Mapbox tiles).
- SSR: the server renders the airport data and an indexable nearby-airports list; the Leaflet map
  hydrates on the client over that fallback so crawlers and no-JS clients still get content.

**Sequencing note.** Weather and more-countries are additive (no schema migration) and are the cheapest
big wins - do them first. Customs and the map both need new columns and a data source, so batch them into
a single D1 migration when you take them on.

---

_Companion to the code-quality snapshots in `docs/assessments/`. This document is product/roadmap
focused; the low-hanging fruits in §C were implemented alongside it._
