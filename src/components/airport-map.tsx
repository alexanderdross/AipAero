"use client";

import type * as L from "leaflet";
import { LocateFixedIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AirportCoord } from "~/server/db/queries";

export interface MapMarker {
  title: string;
  href: string;
  type: AirportCoord["type"];
  lat: number;
  lon: number;
  // Facts flags for the filters (computed server-side in /api/airport-coords).
  // Optional: cached marker responses from before the filters existed lack
  // them - the toggles then simply stay hidden until the cache refreshes.
  fuel?: boolean;
  customs?: boolean;
  paved?: boolean;
}

// Filter keys, AND-combined: an enabled filter keeps only markers that are
// KNOWN to have the attribute (facts may be missing - false is "unknown", so
// filtering is conservative, never asserting a negative).
type FilterKey = "fuel" | "customs" | "paved";
const FILTER_KEYS: FilterKey[] = ["fuel", "customs", "paved"];

// Marker colour by type - matches the flight-category / brand palette and clears
// contrast on the light OSM tiles.
const COLOR: Record<string, string> = {
  vfr: "#166534",
  ifr: "#1d4ed8",
  heliport: "#86198f",
  mil: "#b91c1c",
  aeroport: "#525252",
};

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPE[c]!);

/**
 * Client-rendered OpenStreetMap (Leaflet) map of a country's airfields. Leaflet
 * runs entirely in `useEffect` (never during SSR - it needs `window`), so the
 * server emits just the empty container; the indexable airport list beneath it
 * (on the airport-list page) is the no-JS fallback. The "locate" button centres
 * the map on the user's position.
 *
 * The markers are fetched client-side from `/api/airport-coords` rather than
 * passed in as server props: the map is decorative, and keeping hundreds of
 * markers out of the airport-list server render avoids weighing down that heavy
 * page (a Worker "Error 1102 - exceeded resource limits" contributor on the
 * large DE list). While the markers load the empty container reserves its height
 * (no layout shift); if the country has no coordinates the map renders nothing.
 */
export function AirportMap({
  locale,
  locateLabel,
  locateErrorLabel,
  mapLabel,
  fuelLabel,
  customsLabel,
  pavedLabel,
}: {
  locale: string;
  locateLabel: string;
  locateErrorLabel: string;
  mapLabel: string;
  fuelLabel: string;
  customsLabel: string;
  pavedLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<MapMarker[] | null>(null);
  const [inView, setInView] = useState(false);
  // First user input (scroll / pointer / touch / key). The map also gates on
  // this: on mobile its container sits inside the INITIAL viewport, so the
  // IntersectionObserver alone fires immediately and a late-loading OSM tile
  // became the page's Largest Contentful Paint (measured 4.9s on the DE list,
  // Lighthouse run 2026-07-12). The browser finalizes LCP at the first user
  // input, so tiles loaded after it can never be the LCP element - and real
  // visitors produce an input (mouse move, scroll, tap) within moments, so
  // the map still appears effectively on arrival. Same facade reasoning as
  // the click-to-load chart-PDF preview: decorative content must never cost
  // the SEO pages their core metrics.
  const [stirred, setStirred] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const pendingLocateRef = useRef(false);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    fuel: false,
    customs: false,
    paved: false,
  });

  useEffect(() => {
    let active = true;
    // Trailing slash: the app sets `trailingSlash: true`, so the slashless URL
    // 308-redirects - request the canonical form directly to skip that hop.
    fetch(`/api/airport-coords/?locale=${encodeURIComponent(locale)}`)
      .then((r) => (r.ok ? (r.json() as Promise<MapMarker[]>) : []))
      .then((m) => {
        if (active) setMarkers(Array.isArray(m) ? m : []);
      })
      .catch(() => {
        // Fail-soft: render nothing rather than a broken map.
        if (active) setMarkers([]);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  // Defer the heavy Leaflet init + OSM tiles until the decorative map scrolls
  // near the viewport. The map is not page content, but loading its tiles on
  // mount made an OpenStreetMap tile the Largest Contentful Paint and pulled
  // ~40 KiB of images onto the critical path. Gating the init on an
  // IntersectionObserver lets the server-rendered list / title win LCP and
  // keeps the tiles off the initial load. `rootMargin` starts the load just
  // before the map enters view. The cheap marker-JSON fetch above still runs
  // on mount, so empty-coordinate countries collapse before first paint (no
  // layout shift).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, markers]);

  // Arm the one-shot first-input listeners (see `stirred` above). `once` +
  // passive keeps them free; any of the signals releases the map init.
  useEffect(() => {
    if (stirred) return;
    const release = () => setStirred(true);
    const options = { once: true, passive: true } as const;
    const events = [
      "scroll",
      "pointerdown",
      "pointermove",
      "touchstart",
      "keydown",
    ] as const;
    for (const name of events) window.addEventListener(name, release, options);
    return () => {
      for (const name of events) window.removeEventListener(name, release);
    };
  }, [stirred]);

  useEffect(() => {
    if (!inView || !stirred || !markers || markers.length === 0) return;
    let cancelled = false;
    void (async () => {
      // Load Leaflet's stylesheet lazily together with its JS, only when the
      // map actually renders. A top-level `import "leaflet/dist/leaflet.css"`
      // would bake this ~11 KiB into the airport-list route's CSS chunk, which
      // Next then preloads whenever another page prefetches the airport-list
      // <Link> (breadcrumb / menu) - producing a "preloaded but not used"
      // console warning on pages that never show the map. Loading it here keeps
      // it off that route chunk.
      const [LLModule] = await Promise.all([
        import("leaflet"),
        import("leaflet/dist/leaflet.css"),
      ]);
      const LL = LLModule.default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = LL.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;
      leafletRef.current = LL;
      LL.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);
      // Markers live in their own layer group so the filter toggles can
      // redraw them without tearing down the map (tiles would reload).
      layerRef.current = LL.layerGroup().addTo(map);

      // Frame ALL of the country's fields once - filter toggles later change
      // the visible markers but never the framing (a jumping viewport on each
      // toggle would be disorienting).
      const points: [number, number][] = markers.map((m) => [m.lat, m.lon]);
      if (points.length)
        map.fitBounds(points, { padding: [30, 30], maxZoom: 11 });
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      setMapReady(false);
      layerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [markers, inView, stirred]);

  // (Re)draw the marker layer - on init and whenever a filter toggles.
  useEffect(() => {
    const LL = leafletRef.current;
    const layer = layerRef.current;
    if (!mapReady || !LL || !layer || !markers) return;
    layer.clearLayers();
    const active = FILTER_KEYS.filter((k) => filters[k]);
    for (const m of markers) {
      if (!active.every((k) => m[k])) continue;
      const color = COLOR[m.type] ?? "#525252";
      LL.circleMarker([m.lat, m.lon], {
        radius: 6,
        weight: 2,
        color,
        fillColor: color,
        fillOpacity: 0.7,
      })
        .bindPopup(`<a href="${escapeHtml(m.href)}">${escapeHtml(m.title)}</a>`)
        .addTo(layer);
    }
  }, [mapReady, markers, filters]);

  // The locate click may be the FIRST interaction: the input gate then only
  // starts the async map init, so the map isn't ready inside this handler.
  // Remember the intent and run the locate once init completes (effect below).
  useEffect(() => {
    if (mapReady && pendingLocateRef.current) {
      pendingLocateRef.current = false;
      void doLocate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  function handleLocate() {
    if (!mapRef.current) {
      pendingLocateRef.current = true;
      setStirred(true);
      return;
    }
    void doLocate();
  }

  async function doLocate() {
    if (
      !mapRef.current ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setLocateError(locateErrorLabel);
      return;
    }
    setLocateError(null);
    const LL = (await import("leaflet")).default;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const here: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];
        map.setView(here, 10);
        LL.circleMarker(here, {
          radius: 8,
          weight: 3,
          color: "#2d6a9a",
          fillColor: "#2d6a9a",
          fillOpacity: 0.9,
        }).addTo(map);
      },
      () => {
        // Surface the failure instead of silently doing nothing (permission
        // denied, position unavailable, or timeout).
        setLocateError(locateErrorLabel);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // Loaded and this country has no coordinates - render no decorative map.
  // While still loading (markers === null) the container below reserves height.
  if (markers !== null && markers.length === 0) return null;

  // Show a filter toggle only when at least one field is known to have the
  // attribute - a filter that can only ever empty the map is noise (also
  // hides the toggles for cached pre-filter marker responses without flags).
  const filterLabels: Record<FilterKey, string> = {
    fuel: fuelLabel,
    customs: customsLabel,
    paved: pavedLabel,
  };
  const availableFilters = FILTER_KEYS.filter((k) =>
    (markers ?? []).some((m) => m[k]),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Filters + locate share the existing control row (flex-wrap on narrow
          screens), so the toggles add no reserved layout height / CLS. */}
      <div className="mb-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {availableFilters.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filters[key]}
            onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
            className={
              filters[key]
                ? "bg-drossblue rounded-full border border-transparent px-3 py-0.5 text-sm text-white"
                : "text-drossblue border-drossgray-dark/30 hover:border-drossblue rounded-full border bg-white px-3 py-0.5 text-sm"
            }
          >
            {filterLabels[key]}
          </button>
        ))}
        {locateError && (
          <span role="alert" className="text-sm text-red-700">
            {locateError}
          </span>
        )}
        <button
          type="button"
          onClick={handleLocate}
          className="text-drossblue inline-flex items-center gap-x-1 text-sm hover:underline"
        >
          <LocateFixedIcon
            className="h-4 w-4 flex-shrink-0"
            aria-hidden="true"
          />
          <span>{locateLabel}</span>
        </button>
      </div>
      {/* `isolate` contains Leaflet's internal z-indexes (its controls default
          to z-index 1000) in a local stacking context, so they can't paint
          over the mobile menu / drawer overlay (z-50). */}
      {/* The map is decorative - it illustrates coverage, it is not page
          content - so the tile layer is desaturated to greyscale to make it
          recede. Only the tiles are greyed (via the .leaflet-tile-pane child);
          the coloured airfield markers live in a different Leaflet pane and
          keep their colour. Greyscale preserves luminance, so place-label
          contrast on the tiles stays AA-compliant. */}
      <div
        ref={containerRef}
        role="application"
        aria-label={mapLabel}
        className="border-drossgray-dark/15 bg-drossgray isolate h-80 w-full rounded-lg border [&_.leaflet-tile-pane]:grayscale"
      />
    </div>
  );
}
