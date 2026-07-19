"use client";

import dynamic from "next/dynamic";
import type { RunwayFact } from "~/server/db/schema";

/**
 * Deferred loader for the weather + wind island. `AirportWeatherWind` (and its
 * `AirportWeather` -> `metar-decode` glossary, ~15 KB, + `AirportWind` compass
 * trig) is a client-only, fetch-gated box: it renders a skeleton until
 * `/api/airport-weather` resolves. Statically importing it pulled that ~46 KB
 * chunk onto the detail page's critical hydration path even though nothing is
 * visible until the fetch returns - a needless Total-Blocking-Time cost.
 *
 * `next/dynamic({ ssr: false })` splits it into its own chunk that loads AFTER
 * hydration, so the main-thread parse/compile is deferred. `ssr: false` is only
 * allowed inside a Client Component, which is why this thin wrapper exists (the
 * gadgets wrapper that renders it is a Server Component). The box is ephemeral /
 * non-indexable, so skipping its SSR costs no SEO. The loading skeleton matches
 * the component's own so the reserved height (and CLS = 0) is unchanged.
 */
const AirportWeatherWind = dynamic(
  () =>
    import("~/components/airport-weather-wind").then(
      (m) => m.AirportWeatherWind,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="bg-drossgray/40 border-drossgray-dark/15 h-48 animate-pulse rounded-xl border"
        aria-hidden="true"
      />
    ),
  },
);

export function AirportWeatherWindLazy(props: {
  icao: string | null;
  lat: number | null;
  lon: number | null;
  runways: RunwayFact[];
  locale: string;
}) {
  return <AirportWeatherWind {...props} />;
}
