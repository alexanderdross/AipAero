import { NextResponse } from "next/server";
import { getAirportWeather, getNearestWeather } from "~/lib/weather";
import { withEdgeCache } from "~/server/edge-cache";

// Weather payload for the client-side (lazy) weather + wind gadgets. Keeping
// the METAR/TAF fetches here - a separate request the browser makes after the
// document has streamed - lets the airport detail document CLOSE quickly instead
// of holding the stream open while NOAA responds (that long-held stream is what
// Lighthouse scored as document/LCP latency). The indexable facts + location
// boxes stay server-rendered in the page; only this ephemeral weather is lazy.
//
// Fail-soft: any error yields `{ metar: null, taf: null, nearest: null }` so the
// client simply renders nothing. Cached at the edge for 15 min (weather cadence).

export const dynamic = "force-dynamic";

const ICAO_RE = /^[A-Z]{4}$/;

// Repeat hits within the 10-min weather window are served from the Cloudflare
// Cache API (keyed on URL incl. icao/lat/lon) instead of re-invoking the
// handler - the fail-soft empty payload sends no Cache-Control and is
// deliberately never cached (stale METAR/TAF must not be pinned).
export async function GET(request: Request): Promise<Response> {
  return withEdgeCache(request, () => handleWeather(request));
}

async function handleWeather(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const icao = (url.searchParams.get("icao") ?? "").toUpperCase();
  const latRaw = url.searchParams.get("lat");
  const lonRaw = url.searchParams.get("lon");

  const empty = { metar: null, taf: null, nearest: null };
  const icaoValid = ICAO_RE.test(icao);
  const lat = latRaw != null ? Number(latRaw) : NaN;
  const lon = lonRaw != null ? Number(lonRaw) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  // ICAO-less fields (hospital / private helipads) pass coordinates only; serve
  // them the nearest reporting station.
  if (!icaoValid && !hasCoords) return NextResponse.json(empty);

  try {
    const own = icaoValid
      ? await getAirportWeather(icao)
      : { metar: null, taf: null };
    const { metar, taf } = own;

    // Fall back to the nearest reporting station when the field has none of its
    // own (needs coordinates, passed from the server-rendered facts).
    let nearest: {
      station: string;
      distanceKm: number;
    } | null = null;
    let outMetar = metar;
    let outTaf = taf;
    if (!metar && !taf && hasCoords) {
      const near = await getNearestWeather(lat, lon);
      if (near) {
        outMetar = near.metar;
        outTaf = near.taf;
        nearest = { station: near.station, distanceKm: near.distanceKm };
      }
    }

    return NextResponse.json(
      { metar: outMetar, taf: outTaf, nearest },
      {
        headers: {
          "Cache-Control": "public, max-age=900, s-maxage=900",
        },
      },
    );
  } catch {
    return NextResponse.json(empty);
  }
}
