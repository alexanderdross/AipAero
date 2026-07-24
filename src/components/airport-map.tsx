"use client";

import type * as L from "leaflet";
import { LocateFixedIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { localeLangMapping } from "~/i18n/routing";
import {
  isOpenUntil,
  openStatus,
  type StructuredHours,
} from "~/lib/opening-hours";
import type { AirportCoord } from "~/server/db/queries";

// Our weekday index (0 = Monday .. 6 = Sunday). 2024-01-01 is a Monday, so
// day i is that base date + i - used to render localized weekday names.
const WEEKDAY_BASE = Date.UTC(2024, 0, 1);
const utcDow = (d: Date) => (d.getUTCDay() + 6) % 7;

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
  // JSON StructuredHours (UTC) - drives the "Operating hours" tab (open now /
  // open until X). Absent when the field has no structured operation hours.
  hours?: string;
}

// Parse a marker's hours JSON to StructuredHours (7-day), or null (fail-soft).
function markerHours(raw: string | undefined): StructuredHours | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.length === 7 ? (v as StructuredHours) : null;
  } catch {
    return null;
  }
}

// "HH:MM" -> minutes after midnight, or null.
function hhmmToMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
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

// Short type label for the popup (universal aviation abbreviations, so no i18n).
const TYPE_LABEL: Record<string, string> = {
  vfr: "VFR",
  ifr: "IFR",
  heliport: "Heliport",
  mil: "Military",
  aeroport: "Aéroport",
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
  version,
  locateLabel,
  locateErrorLabel,
  mapLabel,
  fuelLabel,
  customsLabel,
  pavedLabel,
  filtersTabLabel,
  hoursTabLabel,
  openNowLabel,
  openUntilLabel,
}: {
  locale: string;
  // Cache-busting version (the country's crawl timestamp, ms). The coords
  // endpoint sits behind the Cloudflare Cache API (`withEdgeCache`), which
  // `revalidateTag` cannot invalidate - so a title/data change would leave the
  // markers frozen on the stale edge entry until its TTL. Threading the crawl
  // timestamp into the request URL gives each crawl a fresh edge key, so the
  // markers (incl. their popup titles) update as soon as the list page does.
  version?: number | null;
  locateLabel: string;
  locateErrorLabel: string;
  mapLabel: string;
  fuelLabel: string;
  customsLabel: string;
  pavedLabel: string;
  filtersTabLabel: string;
  hoursTabLabel: string;
  openNowLabel: string;
  openUntilLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // A marker CLUSTER group (leaflet.markercluster): dense countries (DE ~792
  // fields) overlap into an unreadable blob at the framed zoom, so nearby
  // markers collapse into a count bubble that splits apart on zoom-in. Still a
  // single layer the filter toggles clear + refill, so the tiles never reload.
  const layerRef = useRef<L.MarkerClusterGroup | null>(null);
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
  // Control tabs: the boolean filter pills vs the operation-hours panel.
  const [tab, setTab] = useState<"filters" | "hours">("filters");
  // Operation-hours filter (opening-hours.ts): "open now" and/or "open until X"
  // (default 19:00), AND-combined with each other and the boolean filters.
  const [openNow, setOpenNow] = useState(false);
  const [untilActive, setUntilActive] = useState(false);
  const [untilTime, setUntilTime] = useState("19:00");
  // Weekday the hours filter evaluates (0 = Mon .. 6 = Sun), so a pilot can
  // plan a future day ("open until 19:00 on Wednesday"), not only today.
  // Defaults to today's UTC weekday.
  const [weekday, setWeekday] = useState<number>(() => utcDow(new Date()));
  // Localized weekday names (Mon..Sun) for the filter's day dropdown - from the
  // page locale via Intl, so no per-locale message keys are needed.
  const weekdayNames = useMemo(() => {
    const lang = localeLangMapping[locale] ?? "en";
    const fmt = new Intl.DateTimeFormat(lang, {
      weekday: "long",
      timeZone: "UTC",
    });
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(WEEKDAY_BASE + i * 86_400_000)),
    );
  }, [locale]);

  useEffect(() => {
    let active = true;
    // Trailing slash: the app sets `trailingSlash: true`, so the slashless URL
    // 308-redirects - request the canonical form directly to skip that hop.
    const versionParam = version ? `&v=${version}` : "";
    fetch(
      `/api/airport-coords/?locale=${encodeURIComponent(locale)}${versionParam}`,
    )
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
  }, [locale, version]);

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
      // The clustering plugin augments the SAME Leaflet instance, so it must be
      // imported AFTER leaflet; its CSS is loaded lazily here too (same reason
      // as leaflet.css - keep it off the airport-list route chunk). Bundled with
      // the app, no external origin, so no CSP change.
      await import("leaflet.markercluster");
      await Promise.all([
        import("leaflet.markercluster/dist/MarkerCluster.css"),
        import("leaflet.markercluster/dist/MarkerCluster.Default.css"),
      ]);
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = LL.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;
      leafletRef.current = LL;
      LL.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);
      // Markers live in their own cluster group so the filter toggles can
      // redraw them without tearing down the map (tiles would reload).
      // chunkedLoading keeps the ~800-marker init off the main thread; the
      // coverage-on-hover polygon is off (visual noise on a decorative map).
      layerRef.current = LL.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50,
      }).addTo(map);

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
    const untilMinutes = untilActive ? hhmmToMinutes(untilTime) : null;
    // Evaluate against the chosen weekday (keeping the current UTC time-of-day),
    // so "open until X" plans a future day. Today's weekday -> the live "now".
    const nowDate = new Date();
    const delta = (weekday - utcDow(nowDate) + 7) % 7;
    const now =
      delta === 0 ? nowDate : new Date(nowDate.getTime() + delta * 86_400_000);
    const batch: L.Marker[] = [];
    for (const m of markers) {
      if (!active.every((k) => m[k])) continue;
      // Operation-hours filters (client-side, so any chosen time needs no round
      // trip). Conservative: a field with no/unknown hours is excluded when a
      // hours filter is on (never asserted open).
      if (openNow || untilMinutes != null) {
        const hours = markerHours(m.hours);
        const coords = { lat: m.lat, lon: m.lon };
        // All marker hours are UTC (verified overrides are pre-resolved to the
        // active season's UTC window server-side), so the picker's UTC time and
        // "open now" both evaluate directly in UTC.
        if (openNow && openStatus(hours, coords, now).state !== "open")
          continue;
        if (
          untilMinutes != null &&
          !isOpenUntil(hours, coords, untilMinutes, now)
        )
          continue;
      }
      const color = COLOR[m.type] ?? "#525252";
      // Richer popup: the field title (link) plus a muted line with the type and
      // any quick facts it carries (fuel / customs / paved), reusing the already-
      // localized filter labels - so tapping a marker previews the field instead
      // of showing only its name.
      const facts = [
        m.fuel ? fuelLabel : null,
        m.customs ? customsLabel : null,
        m.paved ? pavedLabel : null,
      ]
        .filter(Boolean)
        .map((s) => escapeHtml(s as string))
        .join(" &middot; ");
      const meta = escapeHtml(TYPE_LABEL[m.type] ?? m.type.toUpperCase());
      const popupHtml =
        `<a href="${escapeHtml(m.href)}" style="font-weight:600">${escapeHtml(m.title)}</a>` +
        `<div style="margin-top:2px;color:#57606a;font-size:12px">${meta}${facts ? " &middot; " + facts : ""}</div>`;
      // A div-icon dot rather than a circleMarker: leaflet.markercluster
      // clusters L.Marker layers, and a divIcon reproduces the coloured dot
      // (fillOpacity 0.7 + coloured stroke + a faint white ring for contrast on
      // the greyscale tiles). Keyboard: L.marker is focusable and its popup
      // opens on Enter (a circleMarker path is not), so this also makes the
      // markers keyboard-reachable. The title = the field name (marker tooltip
      // + accessible name).
      const icon = LL.divIcon({
        className: "",
        html:
          `<span style="display:block;width:12px;height:12px;border-radius:50%;` +
          `background:${color};opacity:.75;border:2px solid ${color};` +
          `box-shadow:0 0 0 1px rgba(255,255,255,.8)"></span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -6],
      });
      batch.push(
        LL.marker([m.lat, m.lon], {
          icon,
          title: m.title,
          alt: m.title,
        }).bindPopup(popupHtml),
      );
    }
    layer.addLayers(batch);
  }, [
    mapReady,
    markers,
    filters,
    openNow,
    untilActive,
    untilTime,
    weekday,
    fuelLabel,
    customsLabel,
    pavedLabel,
  ]);

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
  // The Operating-hours tab appears only when at least one field carries
  // structured hours (mirrors availableFilters - a control that can only ever
  // empty the map is noise).
  const hasHours = (markers ?? []).some((m) => m.hours);
  // Tabs only make sense when BOTH control groups exist; otherwise show the one
  // that applies with no tab chrome.
  const showTabs = hasHours && availableFilters.length > 0;
  const showFilters =
    availableFilters.length > 0 && (!showTabs || tab === "filters");
  const showHours = hasHours && (!showTabs || tab === "hours");
  const pill = (activeState: boolean) =>
    activeState
      ? "bg-drossblue rounded-full border border-transparent px-3 py-0.5 text-sm text-white"
      : "text-drossblue border-drossgray-dark/30 hover:border-drossblue rounded-full border bg-white px-3 py-0.5 text-sm";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Controls + locate. On mobile each group stacks on its own left-aligned
          row (cleaner than a ragged right-justified wrap); on >= sm they flow
          inline, right-aligned. No reserved layout height / CLS either way.
          When the field carries hours, a two-tab switch chooses between the
          boolean filter pills and the operation-hours panel; the time input
          needs its own panel rather than crowding a picker among the pills. */}
      <div className="mb-2 flex flex-col items-start gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-3">
        {showTabs && (
          <div
            role="tablist"
            aria-label={mapLabel}
            className="border-drossgray-dark/30 inline-flex overflow-hidden rounded-full border text-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "filters"}
              onClick={() => setTab("filters")}
              className={
                tab === "filters"
                  ? "bg-drossblue px-3 py-0.5 text-white"
                  : "text-drossblue bg-white px-3 py-0.5"
              }
            >
              {filtersTabLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "hours"}
              onClick={() => setTab("hours")}
              className={
                tab === "hours"
                  ? "bg-drossblue px-3 py-0.5 text-white"
                  : "text-drossblue bg-white px-3 py-0.5"
              }
            >
              {hoursTabLabel}
            </button>
          </div>
        )}
        {/* Boolean-filter pills (fuel / customs / paved), grouped so they form
            one tidy row on mobile. Shown on the Filters tab, or always when
            there are no hours (no tabs then). */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {availableFilters.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filters[key]}
                onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                className={pill(filters[key])}
              >
                {filterLabels[key]}
              </button>
            ))}
          </div>
        )}
        {/* Operation-hours panel: "open now" toggle + "open until [time] UTC".
            AIP AD 2.3 hours are UTC ("Zulu"), so the time input is UTC and is
            labelled as such (pilots plan in UTC). */}
        {showHours && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Weekday selector: evaluate the hours filters against a chosen day
                so pilots can plan ahead. Defaults to today. */}
            <select
              value={weekday}
              aria-label={hoursTabLabel}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="border-drossgray-dark/30 rounded-full border bg-white px-3 py-1 text-sm font-semibold"
            >
              {weekdayNames.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-pressed={openNow}
              onClick={() => setOpenNow((v) => !v)}
              className={pill(openNow)}
            >
              {openNowLabel}
            </button>
            <span className="inline-flex items-center gap-x-2">
              <button
                type="button"
                aria-pressed={untilActive}
                onClick={() => setUntilActive((v) => !v)}
                className={pill(untilActive)}
              >
                {openUntilLabel}
              </button>
              <input
                type="time"
                value={untilTime}
                aria-label={`${openUntilLabel} (UTC)`}
                onChange={(e) => {
                  setUntilTime(e.target.value);
                  setUntilActive(true);
                }}
                className="border-drossgray-dark/30 rounded-md border bg-white px-2 py-0.5 text-sm"
              />
              <span className="text-drossgray-dark text-xs font-semibold">
                UTC
              </span>
            </span>
          </div>
        )}
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
