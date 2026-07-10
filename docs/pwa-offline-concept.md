# Concept: PWA with offline support (service worker)

Goal: evolve the already-installable site (a `manifest.webmanifest` exists via
`src/app/manifest.ts`) into a full PWA with a **service worker and offline
capability**, so a pilot can install AIP:Aero on an EFB tablet, look up fields
on the ground, and still open previously viewed airports (and explicitly saved
charts) in the air with no connectivity.

**Status: Phases 1 + 2 + 3 are implemented** (`public/sw.js`,
`public/offline.html`, `src/components/service-worker-registration.tsx`, the
`/sw.js` Cache-Control header and `worker-src 'self'` in `next.config.mjs`).
Registration is skipped on localhost so `pnpm start`/`pnpm preview` and the
Playwright E2E suite stay SW-free. Phase 3 shipped as
`src/components/save-offline-button.tsx` on the airport-detail pages: it pins
the page (and a direct-PDF chart, `no-cors`) in the never-trimmed
`saved-v1`/`charts-v1` caches, indexes the field in localStorage
(`aip-offline-saved` - the Favorites foundation) and requests storage
persistence; the SW serves saved pages before the browsing cache and saved
chart PDFs to the inline preview embed, and `offline.html` lists saved fields
by title first. Only the optional Phase 4 (explicit country bulk download) is
open - see the storage-limits decision below.

---

## Current state

- **Installable, but no offline:** `src/app/manifest.ts` emits the manifest, so
  Add-to-Home-Screen works. There is **no service worker** - any request without
  network fails with the browser's offline error page.
  - Field finding (10.07.2026): "installable" on Chromium also requires
    **192x192 and 512x512 PNG icons** in the manifest - with only the single
    450x450 JPEG, Chrome/Edge showed no omnibox install icon and never fired
    `beforeinstallprompt` (so the save button's native install dialog stayed
    dead too). Fixed with generated `icon-192.png` / `icon-512.png` plus a
    maskable 512 variant (logo in the ~80% safe zone on white).
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

## Storage limits and country scoping (decision, 10.07.2026)

Question raised by the owner: with more countries coming, does the offline
cache grow too large - and should bookmarking e.g. `/de/` scope the offline
content to Germany?

**Finding: country scoping is already emergent.** The SW does no content
precache (only 3 tiny shell files); everything else is cached **on visit**. A
user who browses only `/de/` only ever caches German pages, and adding new
countries adds zero bytes to existing users' caches. The caps bound the worst
case regardless of country count: 100 pages (~15 MB) + 200 tiles (~5-10 MB) +
30 marker responses, FIFO-trimmed - roughly **20-25 MB maximum** per device.

**Where the real limits are** (Cache Storage quota is per origin,
browser-dependent):

| Browser | Quota | Practical relevance |
| --- | --- | --- |
| Chrome / Edge / Android | up to ~60% of free disk | effectively unlimited here |
| Firefox | up to 10% of disk (max 10 GB) | uncritical |
| Safari / iOS (the EFB device!) | ~1 GB order of magnitude, aggressive eviction | the actual constraint |

Two traps that kill country-level bulk caching of charts:

1. **iOS eviction**: Safari largely ignores `storage.persist()` and evicts
   under pressure; only home-screen-installed PWAs are exempt from the 7-day
   cleanup. The EFB tablet is exactly the constrained device.
2. **Opaque-response padding**: chart PDFs live on foreign AIP hosts without
   CORS. Chromium charges each cached opaque (`no-cors`) response with ~7 MB
   quota padding regardless of real size - ~400 DE chart PDFs would book
   ~2.8 GB of quota. Bulk PDF precaching is therefore a non-starter; PDFs are
   only cached one at a time on explicit user action (Phase 3).

**Decision:** no bookmark- or install-triggered country precache (there is no
bookmark event anyway, and unsolicited multi-MB downloads are hostile to data
plans and batteries). Keep the usage-driven caching; ship Phase 3 for explicit
per-airport saves. An optional **Phase 4** may add an explicit
"make <country> available offline" button on the country page that fetches the
**HTML detail pages only** (~60 MB for DE, no PDFs), with a size estimate and
progress - to be considered only after Phase 3 exists and iOS behaviour has
been tested on a real device.

**Field finding (iOS device test, 10.07.2026):** launching the freshly
installed home-screen app for the first time **while offline** shows the
native "Safari cannot open the page" error - no toolbar, no offline fallback.
Root cause is the storage separation above taken to its conclusion: the
installed app starts with **no service worker and no caches at all** (they
live in Safari's storage, not the app's), so nothing can intercept the
navigation. Fields saved in Safari are equally invisible inside the app.
Countermeasures shipped:

1. `sw.js` snapshots all **currently open client pages** into the pages cache
   right at `activate` (`cacheOpenClients()`) - previously a page was only
   cached on the *next* navigation, so the installed app's start URL itself
   stayed uncached after its first online open. Now **one online launch of the
   app suffices** to make its start page available offline.
2. The iOS/macOS install hints (`Common.installHint`/`installHintMac`) now
   state the operative step: open the app once while online and re-save fields
   **inside the app** (own offline storage).

The platform boundary itself (separate storage, no programmatic install on
Apple platforms) cannot be engineered away.

## Explicitly out of scope

- **Offline search / offline DB replica** (shipping the airport index into
  IndexedDB): real work, questionable value - the pilot flow is "look up on the
  ground, save, fly". Revisit only on user demand.
- **Web Push notifications**: no use case yet.
- **Automatic precaching of all airports of a country**: quota + tile-policy
  hostile (see the storage-limits decision above); the explicit-save flow
  covers the real need, an explicit country-bulk button is at most Phase 4.

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
