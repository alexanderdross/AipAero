import "server-only";

// Server-side METAR/TAF fetch from the NOAA / Aviation Weather Center API
// (https://aviationweather.gov/data/api/). Free, no key. Runs on the Cloudflare
// Worker at request time; the response is cached for REVALIDATE seconds via the
// OpenNext incremental cache so we hit the upstream at most ~once per airport per
// window. Everything fails soft: a missing station, a non-OK response, malformed
// JSON or a timeout all yield nulls so the airport page still renders (most small
// VFR fields have no reporting station).

const API = "https://aviationweather.gov/api/data";
const REVALIDATE = 600; // 10 minutes
const TIMEOUT_MS = 5000;

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

  const m = metarArr?.[0] as Record<string, unknown> | undefined;
  const tf = tafArr?.[0] as Record<string, unknown> | undefined;

  const metar: Metar | null =
    m && typeof m.rawOb === "string"
      ? {
          raw: m.rawOb,
          obsTime: typeof m.reportTime === "string" ? m.reportTime : null,
          fltCat: typeof m.fltCat === "string" ? m.fltCat : null,
          wdir:
            typeof m.wdir === "number" || typeof m.wdir === "string"
              ? m.wdir
              : null,
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
        }
      : null;

  const taf: Taf | null =
    tf && typeof tf.rawTAF === "string" ? { raw: tf.rawTAF } : null;

  return { metar, taf };
}
