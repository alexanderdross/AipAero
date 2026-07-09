import { NextResponse } from "next/server";
import { getAirportWeather, getNearestWeather } from "~/lib/weather";

// Weather payload for the client-side (lazy) weather + wind gadgets. Keeping
// the METAR/TAF fetches here - a separate request the browser makes after the
// document has streamed - lets the airport detail document CLOSE quickly instead
// of holding the stream open while NOAA responds (that long-held stream is what
// Lighthouse scored as document/LCP latency). The indexable facts + location
// boxes stay server-rendered in the page; only this ephemeral weather is lazy.
//
// Fail-soft: any error yields `{ metar: null, taf: null, nearest: null }` so the
// client simply renders nothing. Cached at the edge for 10 min (weather cadence).

export const dynamic = "force-dynamic";

const ICAO_RE = /^[A-Z]{4}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const icao = (url.searchParams.get("icao") ?? "").toUpperCase();
  const latRaw = url.searchParams.get("lat");
  const lonRaw = url.searchParams.get("lon");

  const empty = { metar: null, taf: null, nearest: null };
  if (!ICAO_RE.test(icao)) return NextResponse.json(empty);

  try {
    const { metar, taf } = await getAirportWeather(icao);

    // Fall back to the nearest reporting station when the field has none of its
    // own (needs coordinates, passed from the server-rendered facts).
    let nearest: {
      station: string;
      distanceKm: number;
    } | null = null;
    let outMetar = metar;
    let outTaf = taf;
    if (!metar && !taf && latRaw != null && lonRaw != null) {
      const lat = Number(latRaw);
      const lon = Number(lonRaw);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const near = await getNearestWeather(lat, lon);
        if (near) {
          outMetar = near.metar;
          outTaf = near.taf;
          nearest = { station: near.station, distanceKm: near.distanceKm };
        }
      }
    }

    return NextResponse.json(
      { metar: outMetar, taf: outTaf, nearest },
      {
        headers: {
          "Cache-Control": "public, max-age=600, s-maxage=600",
        },
      },
    );
  } catch {
    return NextResponse.json(empty);
  }
}
