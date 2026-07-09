"use client";

import { useEffect, useState } from "react";
import { AirportWeather } from "~/components/airport-weather";
import { AirportWind } from "~/components/airport-wind";
import type { Metar, Taf } from "~/lib/weather";
import type { RunwayFact } from "~/server/db/schema";

interface WeatherPayload {
  metar: Metar | null;
  taf: Taf | null;
  nearest: { station: string; distanceKm: number } | null;
}

/**
 * Lazy (client-side) weather + wind boxes. The ephemeral METAR/TAF is fetched
 * from `/api/airport-weather` AFTER the document has streamed, so the airport-
 * detail document closes quickly instead of holding the stream open while NOAA
 * responds - that long-held stream is what Lighthouse scored as document/LCP
 * latency. The indexable location + aerodrome-data boxes (and the Airport JSON-LD)
 * stay server-rendered in the page; only this weather is deferred.
 *
 * `runways` come from the server-rendered facts (so the wind compass works the
 * moment the weather arrives). A fixed-height skeleton is shown while loading to
 * avoid layout shift.
 */
export function AirportWeatherWind({
  icao,
  lat,
  lon,
  runways,
  locale,
}: {
  icao: string | null;
  lat: number | null;
  lon: number | null;
  runways: RunwayFact[];
  locale: string;
}) {
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Need either an ICAO (own station) or coordinates (nearest station).
    if (!icao && (lat == null || lon == null)) {
      setLoading(false);
      return;
    }
    let active = true;
    const params = new URLSearchParams();
    if (icao) params.set("icao", icao);
    if (lat != null) params.set("lat", String(lat));
    if (lon != null) params.set("lon", String(lon));

    fetch(`/api/airport-weather?${params.toString()}`)
      .then((r) => (r.ok ? (r.json() as Promise<WeatherPayload>) : null))
      .then((json) => {
        if (active) setData(json);
      })
      .catch(() => {
        /* fail-soft: render nothing */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [icao, lat, lon]);

  if (loading) {
    // Reserve roughly the height of the weather box to avoid layout shift.
    return (
      <div
        className="bg-drossgray/40 h-48 animate-pulse rounded border border-[#eee]"
        aria-hidden="true"
      />
    );
  }

  if (!data) return null;

  return (
    <>
      <AirportWeather
        metar={data.metar}
        taf={data.taf}
        locale={locale}
        nearest={data.nearest}
      />
      <AirportWind metar={data.metar} runways={runways} />
    </>
  );
}
