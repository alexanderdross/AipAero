import type { RunwayFact } from "~/server/db/schema";

/**
 * Pure geometry + surface-colour helpers for the scaled top-down runway-layout
 * diagram (`~/components/airport-runway-diagram`). Kept out of the component so
 * the length scaling and surface mapping are unit-testable. The diagram
 * complements the wind box (which normalises every runway to one compass radius):
 * here the runways are drawn to RELATIVE length at their true bearing, so a field
 * with one long paved runway and a short grass strip reads at a glance - and it
 * renders for EVERY field with runway data, not only the ones with a METAR.
 */

export interface RunwayEnd {
  label: string; // designator token, e.g. "06L"
  heading: number; // bearing in degrees (n * 10)
}

export interface RunwayStrip {
  ident: string; // "06/24"
  ends: RunwayEnd[]; // the two (or one) parsed ends
  bearing: number; // physical centre-line bearing (0..179)
  scale: number; // relative drawn length, 0..1
  color: string; // surface colour
  surface: string | null;
  lengthFt: number | null;
}

/** Map a free-text surface to a fill colour (paved/grass/gravel/water/other). */
export function surfaceColor(surface: string | null | undefined): string {
  const s = (surface ?? "").toLowerCase();
  if (/asp|asph|concrete|conc|pav|bitum|seal|tar|paved|pem/.test(s))
    return "#52606d"; // paved - slate
  if (/gras|turf|grn|lawn/.test(s)) return "#4d7c0f"; // grass - green
  if (/grav|gvl|dirt|earth|sand|clay|coral|later|murram|soil/.test(s))
    return "#b45309"; // unpaved loose - brown
  if (/water/.test(s)) return "#0369a1"; // water
  if (/snow|ice/.test(s)) return "#93c5fd"; // snow/ice
  return "#6b7280"; // unknown - neutral grey
}

/** Parse the runway-end designators from an ident like "06/24" or "06L/24R". */
export function parseRunwayEnds(ident: string): RunwayEnd[] {
  const out: RunwayEnd[] = [];
  const seen = new Set<number>();
  for (const raw of ident.split("/")) {
    const e = raw.trim();
    const m = /^(\d{1,2})/.exec(e);
    if (!m) continue;
    const n = parseInt(m[1]!, 10);
    if (n < 1 || n > 36 || seen.has(n)) continue;
    seen.add(n);
    out.push({ label: e, heading: n * 10 });
  }
  return out;
}

/**
 * Build the drawable runway strips: relative length scale (longest runway = 1,
 * shorter ones proportional with a floor so they stay visible; a field with no
 * published length gets a neutral mid-length) and surface colour. Runways with
 * no parseable end are dropped; one physical line per ident (reciprocals folded).
 */
export function buildRunwayStrips(runways: RunwayFact[]): RunwayStrip[] {
  const withEnds = runways
    .map((r) => ({ r, ends: parseRunwayEnds(r.ident) }))
    .filter((x) => x.ends.length > 0);
  const lengths = withEnds
    .map((x) => x.r.lengthFt)
    .filter((l): l is number => typeof l === "number" && l > 0);
  const maxLen = lengths.length ? Math.max(...lengths) : 0;
  return withEnds.map(({ r, ends }) => {
    const scale =
      r.lengthFt && maxLen > 0
        ? Math.max(0.4, Math.min(1, r.lengthFt / maxLen))
        : 0.7; // unknown length -> neutral mid-length
    return {
      ident: r.ident,
      ends,
      bearing: ends[0]!.heading % 180,
      scale,
      color: surfaceColor(r.surface),
      surface: r.surface,
      lengthFt: r.lengthFt,
    };
  });
}
