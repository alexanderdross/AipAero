// Head/tail- and cross-wind components per runway, from the reported wind and
// the runway bearing. Pure trigonometry, no API - the wind comes from the METAR
// and the runway bearing from the runway designator (e.g. "06/24" -> 060°/240°).

import type { RunwayFact } from "~/server/db/schema";

export interface RunwayWind {
  ident: string; // runway-end designator, e.g. "06"
  heading: number; // bearing in degrees, e.g. 60
  headwind: number; // kt, positive = headwind, negative = tailwind
  crosswind: number; // kt, absolute value
  crosswindSide: "left" | "right";
}

// Parse the runway-end bearings from a designator like "06/24" or "06L/24R".
function parseEnds(ident: string): { ident: string; heading: number }[] {
  const out: { ident: string; heading: number }[] = [];
  for (const raw of ident.split("/")) {
    const e = raw.trim();
    const m = /^(\d{1,2})/.exec(e);
    if (!m) continue;
    const n = parseInt(m[1]!, 10);
    if (n < 1 || n > 36) continue;
    out.push({ ident: e, heading: n * 10 });
  }
  return out;
}

function component(heading: number, windDir: number, windSpeed: number) {
  // Relative wind angle, normalized to -180..180. sin >= 0 => wind from the right.
  const a = (((windDir - heading + 540) % 360) - 180) * (Math.PI / 180);
  return {
    headwind: Math.round(windSpeed * Math.cos(a)),
    crosswind: Math.round(Math.abs(windSpeed * Math.sin(a))),
    side: Math.sin(a) >= 0 ? ("right" as const) : ("left" as const),
  };
}

/**
 * Wind components for every distinct runway end, given a numeric wind direction
 * (skip when VRB) and speed in knots. Deduplicated by bearing, sorted.
 */
export function runwayWinds(
  runways: RunwayFact[],
  windDir: number,
  windSpeed: number,
): RunwayWind[] {
  const seen = new Set<number>();
  const out: RunwayWind[] = [];
  for (const r of runways) {
    for (const end of parseEnds(r.ident)) {
      if (seen.has(end.heading)) continue;
      seen.add(end.heading);
      const c = component(end.heading, windDir, windSpeed);
      out.push({
        ident: end.ident,
        heading: end.heading,
        headwind: c.headwind,
        crosswind: c.crosswind,
        crosswindSide: c.side,
      });
    }
  }
  return out.sort((a, b) => a.heading - b.heading);
}

/**
 * The runway end most into wind (highest headwind) - the likely/recommended
 * landing direction. null when no end has a positive headwind (calm or pure
 * crosswind), since then wind gives no preference.
 */
export function recommendedLanding(winds: RunwayWind[]): RunwayWind | null {
  let best: RunwayWind | null = null;
  for (const w of winds) {
    if (w.headwind <= 0) continue;
    if (!best || w.headwind > best.headwind) best = w;
  }
  return best;
}

// Point on a compass circle (SVG coords, y down): bearing 0 = up.
export function compassPoint(
  cx: number,
  cy: number,
  r: number,
  bearingDeg: number,
): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}
