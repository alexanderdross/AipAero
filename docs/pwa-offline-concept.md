# Concept: PWA with offline support (service worker)

Goal: evolve the already-installable site (a `manifest.webmanifest` exists via
`src/app/manifest.ts`) into a full PWA with a **service worker and offline
capability**, so a pilot can install AIP:Aero on an EFB tablet, look up fields
on the ground, and still open previously viewed airports (and explicitly saved
charts) in the air with no connectivity.

This is a **spec, not yet implemented**. It needs the scope decision in "Phasing"
below.

---

## Current state

- **Installable, but no offline:** `src/app/manifest.ts` emits the manifest, so
  Add-to-Home-Screen works. There is **no service worker** - any request without
  network fails with the browser's offline error page.
- Two properties of the current architecture make offline unusually cheap here:
  1. **`experimental.inlineCss`**: every HTML document carries its CSS inline,
     so a cached HTML page renders correctly offline without extra requests.
  2. The heavy gadgets are already **fail-soft**: weather/wind and map markers
     are client-fetched and render nothing on failure, so a cached detail page
     degrades gracefully offline instead of breaking.
- Cross-origin dependencies at runtime: OSM tiles (map), `aviationweather.gov`
  (weather via our API), national AIP hosts (chart links/PDFs, often without
  CORS).

## Safety constraint (aviation-specific, non-negotiable)

Offline aeronautical data is a **currency risk**: charts and AIP data follow the
AIRAC cycle. Anything served from cache must be visibly dated - never silently
stale:

- Every offline-served page shows an **"offline copy from <date>" banner**.
- Saved charts show the **crawl/save timestamp** (the `Last updated` data and
  per-country `crawl_meta` timestamp already exist).
- Weather is **never** served stale from the SW cache (METAR/TAF older than ~1-2h
  is operationally useless; the observed time is already displayed, and the
  weather box simply stays empty offline).

## Architecture

### Service worker delivery on OpenNext / Cloudflare Workers

A hand-rolled, dependency-free `public/sw.js` (plain JS, no build step), served
as a static asset by the Worker. Registration in a tiny client component in the
root/locale layouts (`navigator.serviceWorker.register("/sw.js")`, gated on
production). Two platform requirements:

- `sw.js` must be served with `Cache-Control: no-cache` (or short max-age) so SW
  updates propagate; add a header rule for it in `next.config.mjs` headers().
- CSP: the current policy must allow the worker (`worker-src 'self'`, and keep
  `sw.js` under `script-src 'self'`).

**Why not `next-pwa`/Serwist first:** both inject a Workbox/Serwist precache
manifest at build time, which the OpenNext adapter does not officially support -
an unsupported integration point that can silently break on Next upgrades (same
reasoning as the rejected polyfill hack). The runtime-caching subset we need is
~150 lines of vanilla SW. Revisit Serwist (`@serwist/next`) only if precaching
of the full build manifest ever becomes a requirement.

### Caching strategies per resource class

| Resource | Strategy | Notes |
| --- | --- | --- |
| `/_next/static/*` (hashed JS/CSS/fonts) | **Cache-first**, no expiry | Content-hashed, immutable; safe forever |
| HTML documents (all pages) | **Network-first**, fall back to cache, then offline page | Cache a copy of every successfully viewed page (self-contained thanks to inlineCss); banner when served from cache |
| `/api/airport-coords` (map markers) | **Stale-while-revalidate**, 1 day cap | Decorative; staleness harmless |
| `/api/airport-weather` | **Network-only** | Safety: no stale METAR/TAF, box stays empty offline |
| OSM tiles | **Cache-first with expiry** (e.g. 7 days, LRU cap ~200 tiles) | Keeps the map usable offline for visited areas; respects OSM tile policy by capping volume |
| Chart PDFs (cross-origin AIP hosts) | **Explicit save only** (Phase 3) | Not auto-cached: large, opaque (no-CORS) responses count against quota opaquely; only on user action |
| `/manifest.webmanifest`, logo, icons | Cache-first | Tiny app-shell set, precached on SW install |

### Offline fallback page

A minimal static page (precached on install) shown when a navigation misses both
network and cache: logo, localized "You are offline" line, and a client-side
list of the user's cached airport pages (enumerated from the Cache Storage keys)
so the pilot can still jump to anything previously viewed. Localization via the
existing message files at build time (one static page per locale is overkill;
one page reading `document.documentElement.lang` set by the cached shell, or
plain English + icons, is acceptable for Phase 1).

### "Save for offline" (Phase 3, the pilot feature)

A button on the airport detail page ("Für offline speichern") that:

1. Fetches and caches the detail page HTML + the chart PDF (`no-cors` fetch into
   a dedicated `charts-v<N>` cache; opaque responses are fine for same-URL
   replay through the SW).
2. Records the save in `localStorage` (slug, title, timestamp) - this doubles as
   the wishlist's **Favorites** feature (see `docs/pilot-wishlist.md`), one
   implementation for both.
3. Shows saved state + saved-at date; the offline page and (later) a
   "Saved airports" section list these entries.
4. Storage guard: check `navigator.storage.estimate()` before saving, request
   `navigator.storage.persist()` for EFB reliability, and surface failures.

### SW lifecycle / updates

- Cache names carry a version (`static-v<N>`, `pages-v<N>`, ...) derived from
  `NEXT_PUBLIC_BUILD_DATE` (already stamped at build time); `activate` deletes
  old versions.
- `skipWaiting` + `clients.claim()` on install, so a deploy takes effect on the
  next navigation - no in-page "update available" prompt needed at this app's
  interaction depth.

## Explicitly out of scope

- **Offline search / offline DB replica** (shipping the airport index into
  IndexedDB): real work, questionable value - the pilot flow is "look up on the
  ground, save, fly". Revisit only on user demand.
- **Web Push notifications**: no use case yet.
- **Precaching all airports of a country**: quota + tile-policy hostile; the
  explicit-save flow covers the real need.

## Phasing

1. **Phase 1 - SW + offline shell:** `public/sw.js` (static-asset + HTML
   caching, offline fallback page), registration component, CSP/header tweaks.
   Ships visible value: everything once viewed works offline, with banner.
2. **Phase 2 - runtime polish:** OSM tile cache, `airport-coords` SWR cache,
   cached-copy banner wiring, storage persistence request.
3. **Phase 3 - explicit chart saving + favorites:** the save button, the
   `charts` cache, the localStorage index shared with Favorites.

## Verification

- `pnpm build` + `pnpm cf-build`; manual `pnpm preview` (miniflare): install the
  PWA, load `/de/vfr/?EDNY`, go offline (DevTools), confirm the page + fallback
  page render and the weather box stays silently empty.
- Lighthouse installability checks stay green; no regression in the existing
  budgets (`.lighthouserc.cjs`) - the SW must not delay first paint (register
  after `load`).
- E2E: a Playwright spec that registers the SW, goes offline via CDP, and
  asserts the offline fallback + a cached detail page.
- CSP report stream stays clean (no `worker-src` violations).

## Risks

- **Stale-content complaints**: mitigated by the banner + timestamps (safety
  section above) - this is the one risk that must never be traded away.
- **Quota on iOS** (Safari evicts aggressively): `persist()` + honest UI when a
  saved chart was evicted (re-save prompt).
- **AdSense offline**: ads simply do not render offline (the script fails
  fail-soft); no action needed.
- **OpenNext upgrades**: the SW is a plain static asset + client registration -
  zero coupling to the adapter's internals by design.
