/*
 * AIP:Aero service worker - hand-rolled, dependency-free (see
 * docs/pwa-offline-concept.md for the full concept and the reasoning against
 * next-pwa/Serwist on the OpenNext adapter).
 *
 * Cache strategies per resource class:
 *   - /_next/static/* (content-hashed)  -> cache-first, no expiry
 *   - HTML navigations                  -> network-first, cached fallback with
 *                                          an "offline copy" banner, then
 *                                          /offline.html
 *   - /api/airport-coords (map markers) -> stale-while-revalidate (decorative)
 *   - /api/airport-weather              -> NOT intercepted (network-only):
 *                                          stale METAR/TAF must never be served
 *   - OSM tiles                         -> cache-first, capped (tile policy)
 *   - everything else                   -> NOT intercepted
 *
 * Safety rule (aviation): anything served from cache must be visibly dated -
 * cached HTML gets a banner with its stored timestamp, never a silent copy.
 *
 * Bump VERSION to invalidate all caches on structural changes. Keep the
 * PAGES cache name in sync with public/offline.html (it enumerates it).
 */

const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const TILES_CACHE = `tiles-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;
// Explicit "save for offline" (Phase 3, written by save-offline-button.tsx):
// never trimmed, so a pilot's saved fields cannot be FIFO-evicted by browsing.
const SAVED_CACHE = `saved-${VERSION}`;
const CHARTS_CACHE = `charts-${VERSION}`;

const PRECACHE_URLS = ["/offline.html", "/logo.webp", "/manifest.webmanifest"];

// FIFO caps so Cache Storage cannot grow unbounded (OSM tile policy asks for
// restraint; pages/data are just hygiene).
const PAGES_MAX = 100;
const TILES_MAX = 200;
const DATA_MAX = 30;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([
    STATIC_CACHE,
    PAGES_CACHE,
    TILES_CACHE,
    DATA_CACHE,
    SAVED_CACHE,
    CHARTS_CACHE,
  ]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // keys() returns insertion order - drop the oldest first.
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
  );
}

// Store a copy stamped with the cache time, so offline serves can show a dated
// banner instead of a silently stale page.
async function withTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set("sw-cached-at", new Date().toUTCString());
  headers.delete("Content-Length");
  const body = await response.clone().blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Localized banner texts, keyed by the ISO language code of the page's
// <html lang> attribute (see localeLangMapping in src/i18n/routing.ts: en, de,
// fr, nl, cs, da, el, nb, pl, sv). Fixed vocabulary in code, not site i18n -
// the SW has no message-file access (same reasoning as the METAR glossary).
// {date} is replaced with the stored UTC timestamp (UTC is the aviation norm).
const BANNER_TEXTS = {
  en: "Offline copy from {date} - aeronautical data may be out of date",
  de: "Offline-Kopie vom {date} - Luftfahrtdaten sind möglicherweise veraltet",
  fr: "Copie hors ligne du {date} - les données aéronautiques peuvent être obsolètes",
  nl: "Offline kopie van {date} - luchtvaartgegevens kunnen verouderd zijn",
  cs: "Offline kopie z {date} - letecká data mohou být zastaralá",
  da: "Offline kopi fra {date} - luftfartsdata kan være forældede",
  el: "Αντίγραφο εκτός σύνδεσης από {date} - τα αεροναυτικά δεδομένα ενδέχεται να είναι παρωχημένα",
  nb: "Frakoblet kopi fra {date} - luftfartsdata kan være utdaterte",
  pl: "Kopia offline z {date} - dane lotnicze mogą być nieaktualne",
  sv: "Offlinekopia från {date} - flygdata kan vara föråldrade",
};

// Rewrite cached HTML with a sticky "offline copy" banner right after <body>,
// in the page's own language (sniffed from its <html lang> attribute).
// Aviation data must never be served stale without a visible date.
async function injectOfflineBanner(cached) {
  const contentType = cached.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return cached;
  const cachedAt = cached.headers.get("sw-cached-at");
  let html = await cached.text();
  const langMatch = html.match(/<html[^>]*\blang="([a-z]{2})/i);
  const lang = langMatch ? langMatch[1].toLowerCase() : "en";
  const text = (BANNER_TEXTS[lang] || BANNER_TEXTS.en).replace(
    "{date}",
    cachedAt || "?",
  );
  const banner =
    '<div style="position:sticky;top:0;z-index:9999;background:#b45309;color:#fff;text-align:center;padding:8px 16px;font:14px/1.4 sans-serif">' +
    "&#9888; " +
    text +
    "</div>";
  html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
    return "<body" + attrs + ">" + banner;
  });
  const headers = new Headers(cached.headers);
  headers.delete("Content-Length");
  return new Response(html, { status: 200, headers });
}

async function handleNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, await withTimestamp(fresh));
      trimCache(PAGES_CACHE, PAGES_MAX);
    }
    return fresh;
  } catch (_err) {
    // Full-URL match (incl. search): every ?ICAO detail page is its own entry.
    // Explicitly saved pages win over the FIFO-trimmed browsing cache.
    const savedCache = await caches.open(SAVED_CACHE);
    const saved = await savedCache.match(request);
    if (saved) return injectOfflineBanner(saved);
    const cached = await cache.match(request);
    if (cached) return injectOfflineBanner(cached);
    const offline = await caches.match("/offline.html");
    if (offline) return offline;
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  // Opaque responses (no-cors OSM tiles) report status 0 but are cacheable.
  if (fresh.ok || fresh.type === "opaque") {
    const cache = await caches.open(cacheName);
    await cache.put(request, fresh.clone());
    if (maxEntries) trimCache(cacheName, maxEntries);
  }
  return fresh;
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((fresh) => {
      if (fresh.ok) {
        cache.put(request, fresh.clone());
        trimCache(cacheName, maxEntries);
      }
      return fresh;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const fresh = await update;
  if (fresh) return fresh;
  // Offline with no cached copy: the map is decorative, empty markers are fine.
  return new Response("[]", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (
      url.pathname.startsWith("/_next/static/") ||
      PRECACHE_URLS.includes(url.pathname)
    ) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }
    if (url.pathname.startsWith("/api/airport-coords")) {
      event.respondWith(staleWhileRevalidate(request, DATA_CACHE, DATA_MAX));
      return;
    }
    // /api/airport-weather and all other same-origin requests: network-only
    // (no respondWith) - weather must never be served stale.
    return;
  }

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirst(request, TILES_CACHE, TILES_MAX));
    return;
  }

  // Explicitly saved chart PDFs (cross-origin AIP hosts): the inline preview
  // <object> embed is intercepted here and served from the charts cache when
  // saved, so it works offline. Nothing is cached implicitly - misses just
  // pass through to the network.
  if (
    request.destination === "object" ||
    request.destination === "embed" ||
    request.destination === "iframe"
  ) {
    event.respondWith(
      caches
        .open(CHARTS_CACHE)
        .then((cache) => cache.match(request))
        .then((cached) => cached || fetch(request)),
    );
    return;
  }
  // Other cross-origin requests (AIP hosts, ads, analytics): untouched.
});
