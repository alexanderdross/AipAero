"use client";

import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";
import { LocateFixedIcon } from "lucide-react";
import { useEffect, useRef } from "react";
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
 * (on the airport-list page) is the no-JS fallback. Only mounted when there are
 * markers to show. The "locate" button centres the map on the user's position.
 */
export function AirportMap({
  markers,
  locateLabel,
  mapLabel,
}: {
  markers: MapMarker[];
  locateLabel: string;
  mapLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const LL = (await import("leaflet")).default;
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
  }, [markers]);

  async function handleLocate() {
    if (
      !mapRef.current ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    )
      return;
    const LL = (await import("leaflet")).default;
    navigator.geolocation.getCurrentPosition((pos) => {
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
    });
  }

  return (
    <div className="mx-auto mb-6 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-2 flex justify-end">
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
      <div
        ref={containerRef}
        role="application"
        aria-label={mapLabel}
        className="h-80 w-full rounded border border-[#ccc] bg-white"
      />
    </div>
  );
}
