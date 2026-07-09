import "server-only";

import { haversineKm } from "~/lib/distance";

// Server-side METAR/TAF fetch from the NOAA / Aviation Weather Center API
// (https://aviationweather.gov/data/api/). Free, no key. Runs on the Cloudflare
// Worker at request time; the response is cached for REVALIDATE seconds via the
// OpenNext incremental cache so we hit the upstream at most ~once per airport per
// window. Everything fails soft: a missing station, a non-OK response, malformed
// JSON or a timeout all yield nulls so the airport page still renders (most small
// VFR fields have no reporting station).

const API = "https://aviationweather.gov/api/data";
const REVALIDATE = 600; // 10 minutes
// Keep this tight: the fetch is awaited during SSR (the page is buffered, not
// streamed, because of `htmlLimitedBots`), so a slow upstream directly delays
// TTFB on a cache miss. Fail soft to no-weather rather than hold the response.
const TIMEOUT_MS = 3000;

export interface CloudLayer {
  cover: string;
  base: number | null;
}

export interface Metar {
  raw: string;
  obsTime: string | null; // ISO 8601 (UTC)
  fltCat: string | null; // VFR | MVFR | IFR | LIFR
  wdir: number | string | null; // degrees, or "VRB"
  wspd: number | null; // knots
  wgst: number | null; // knots (gust)
  visib: string | number | null;
  temp: number | null; // °C
  dewp: number | null; // °C
  altim: number | null; // QNH, hPa
  clouds: CloudLayer[];
  lat: number | null; // station latitude (deg)
  lon: number | null; // station longitude (deg)
  elev: number | null; // station elevation (metres)
}

export interface Taf {
  raw: string;
}

const isIcao = (s: string) => /^[A-Z]{4}$/.test(s);

async function fetchArray(url: string): Promise<unknown[] | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

function parseMetar(m: Record<string, unknown> | undefined): Metar | null {
  if (!m || typeof m.rawOb !== "string") return null;
  return {
    raw: m.rawOb,
    obsTime: typeof m.reportTime === "string" ? m.reportTime : null,
    fltCat: typeof m.fltCat === "string" ? m.fltCat : null,
    wdir:
      typeof m.wdir === "number" || typeof m.wdir === "string" ? m.wdir : null,
    wspd: num(m.wspd),
    wgst: num(m.wgst),
    visib:
      typeof m.visib === "number" || typeof m.visib === "string"
        ? m.visib
        : null,
    temp: num(m.temp),
    dewp: num(m.dewp),
    altim: num(m.altim) === null ? null : Math.round(m.altim as number),
    clouds: Array.isArray(m.clouds) ? (m.clouds as CloudLayer[]) : [],
    lat: num(m.lat),
    lon: num(m.lon),
    elev: num(m.elev),
  };
}

const parseTaf = (tf: Record<string, unknown> | undefined): Taf | null =>
  tf && typeof tf.rawTAF === "string" ? { raw: tf.rawTAF } : null;

export async function getAirportWeather(
  icaoRaw: string | null | undefined,
): Promise<{ metar: Metar | null; taf: Taf | null }> {
  const empty = { metar: null, taf: null };
  if (!icaoRaw) return empty;
  const icao = icaoRaw.toUpperCase();
  if (!isIcao(icao)) return empty;

  const [metarArr, tafArr] = await Promise.all([
    fetchArray(`${API}/metar?ids=${icao}&format=json`),
    fetchArray(`${API}/taf?ids=${icao}&format=json`),
  ]);

  return {
    metar: parseMetar(metarArr?.[0] as Record<string, unknown> | undefined),
    taf: parseTaf(tafArr?.[0] as Record<string, unknown> | undefined),
  };
}

export interface NearestWeather {
  metar: Metar;
  taf: Taf | null;
  station: string; // reporting station ICAO
  distanceKm: number;
}

/**
 * Nearest reporting station's weather for a field that has no METAR of its own.
 * Queries NOAA for all stations in a ~111 km box around the coordinates, picks
 * the closest with a valid report, and fetches its TAF. Fail-soft (null when no
 * station is in range). The caller labels it clearly as nearest-airport data.
 */
export async function getNearestWeather(
  lat: number,
  lon: number,
): Promise<NearestWeather | null> {
  const d = 1.0; // degrees (~111 km) - keep the substitute regionally relevant
  const arr = await fetchArray(
    `${API}/metar?bbox=${lat - d},${lon - d},${lat + d},${lon + d}&format=json`,
  );
  if (!arr?.length) return null;

  let best: Record<string, unknown> | null = null;
  let bestDist = Infinity;
  for (const raw of arr) {
    const m = raw as Record<string, unknown>;
    if (typeof m.rawOb !== "string") continue;
    const mlat = num(m.lat);
    const mlon = num(m.lon);
    if (mlat == null || mlon == null) continue;
    const dist = haversineKm(lat, lon, mlat, mlon);
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }

  const metar = parseMetar(best ?? undefined);
  if (!metar || !best) return null;
  const station = typeof best.icaoId === "string" ? best.icaoId : "";
  const tafArr = station
    ? await fetchArray(`${API}/taf?ids=${station}&format=json`)
    : null;

  return {
    metar,
    taf: parseTaf(tafArr?.[0] as Record<string, unknown> | undefined),
    station,
    distanceKm: Math.round(bestDist),
  };
}
