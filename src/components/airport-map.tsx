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
}

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
}: {
  locale: string;
  locateLabel: string;
  locateErrorLabel: string;
  mapLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<MapMarker[] | null>(null);
  const [inView, setInView] = useState(false);

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

  useEffect(() => {
    if (!inView || !markers || markers.length === 0) return;
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
      LL.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      const points: [number, number][] = [];
      for (const m of markers) {
        const color = COLOR[m.type] ?? "#525252";
        LL.circleMarker([m.lat, m.lon], {
          radius: 6,
          weight: 2,
          color,
          fillColor: color,
          fillOpacity: 0.7,
        })
          .bindPopup(
            `<a href="${escapeHtml(m.href)}">${escapeHtml(m.title)}</a>`,
          )
          .addTo(map);
        points.push([m.lat, m.lon]);
      }
      if (points.length)
        map.fitBounds(points, { padding: [30, 30], maxZoom: 11 });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [markers, inView]);

  async function handleLocate() {
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center justify-end gap-x-3">
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
