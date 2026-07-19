// OpenStreetMap `opening_hours` -> our structured, UTC operation-hours model
// (see `opening-hours.ts`). OSM is a COMMUNITY, opportunistic fallback for the
// long tail of small fields the AIP does not publish hours for; it is the
// LOWEST-precedence source (below eaip and openaip) and is labelled "community"
// in the UI. Conservative by design: anything this small parser does not
// confidently understand becomes `unknown` (never a guessed "open").
//
// CRITICAL - LOCAL vs UTC: OSM `HH:MM` are LOCAL wall-clock times, but our model
// is UTC. Fixed windows are converted local -> UTC from the field's LONGITUDE
// (15deg = 1h, the same solar approximation the codebase already uses; it
// ignores political tz boundaries and DST - acceptable under the advisory
// framing). Solar boundaries (`sunrise`/`sunset`) are offset-independent and
// pass through unchanged. When no coordinates are known, a fixed window cannot
// be placed on the UTC clock and is dropped to `unknown`.
//
// Pure and dependency-light (no network/env) so it is unit-testable and can run
// on the read-path write-back that persists an `hours_source="osm"` fallback.

import type { Boundary, DayHours, StructuredHours } from "~/lib/opening-hours";

// OSM two-letter weekday tokens -> our index (0 = Monday .. 6 = Sunday).
const OSM_DAY: Record<string, number> = {
  mo: 0,
  tu: 1,
  we: 2,
  th: 3,
  fr: 4,
  sa: 5,
  su: 6,
};

// Longitude -> UTC offset in minutes (east positive; local = UTC + offset).
function utcOffsetMinutes(lon: number): number {
  return Math.round(lon / 15) * 60;
}

// One local "HH:MM" -> a UTC-minute Boundary, or null when it cannot be placed
// on the UTC clock (no coords, malformed, or the conversion wraps past
// midnight - which would change the day and is not worth asserting for a
// community fallback).
function localTimeToUtcBoundary(
  hhmm: string,
  coords: { lat: number; lon: number } | null,
): Boundary | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || !coords) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  const local = h * 60 + min;
  const utc = local - utcOffsetMinutes(coords.lon);
  if (utc < 0 || utc > 1440) return null; // wrapped a day - do not assert
  return { t: "time", m: utc };
}

// A solar keyword -> a solar Boundary (offset-independent), else null.
function solarBoundary(tok: string): Boundary | null {
  const t = tok.trim().toLowerCase();
  if (t === "sunrise" || t === "dawn") return { t: "sr" };
  if (t === "sunset" || t === "dusk") return { t: "ss" };
  return null;
}

function timeBoundary(
  tok: string,
  coords: { lat: number; lon: number } | null,
): Boundary | null {
  return solarBoundary(tok) ?? localTimeToUtcBoundary(tok, coords);
}

// Expand a day selector ("Mo-Fr", "Mo,We,Fr", "Sa", "Mo-Su") to day indices, or
// null when it references anything we do not model (PH/SH holidays, weeks, etc).
function parseDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const p = part.trim().toLowerCase();
    if (!p) continue;
    const range = /^([a-z]{2})-([a-z]{2})$/.exec(p);
    if (range?.[1] && range[2]) {
      const a = OSM_DAY[range[1]];
      const b = OSM_DAY[range[2]];
      if (a == null || b == null) return null;
      // Inclusive, wrapping range (e.g. Sa-Su, or Fr-Mo).
      for (let i = a; ; i = (i + 1) % 7) {
        out.add(i);
        if (i === b) break;
      }
      continue;
    }
    const single = OSM_DAY[p];
    if (single == null) return null; // PH, SH, week specs, ... -> unmodelled
    out.add(single);
  }
  return out.size ? [...out] : null;
}

/**
 * Parse an OSM `opening_hours` string into our 7-day `StructuredHours` (UTC),
 * or `null` when nothing usable can be extracted. Handles the common aerodrome
 * cases: `24/7`, `Mo-Fr 08:00-18:00; Sa 09:00-13:00`, `sunrise-sunset`, `off`.
 * Days not covered by any rule stay `unknown`; anything unmodelled (holidays,
 * week/month selectors, ambiguous syntax) is left `unknown` rather than guessed.
 * `coords` supplies the longitude for the local->UTC conversion of fixed times.
 */
export function parseOsmHours(
  raw: unknown,
  coords: { lat: number; lon: number } | null,
): StructuredHours | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  // Strip quoted comments ("by appointment") - they carry no schedule.
  const cleaned = text.replace(/"[^"]*"/g, " ").trim();
  if (!cleaned) return null;

  if (/^24\s*\/\s*7$/i.test(cleaned)) return Array(7).fill({ kind: "h24" });

  const days: (DayHours | null)[] = Array(7).fill(null);
  let matchedAnything = false;

  for (const ruleRaw of cleaned.split(";")) {
    const rule = ruleRaw.trim();
    if (!rule) continue;

    // A rule is "[DAYS] TIMES". Split off a leading day selector if present;
    // a bare time range (no day token) applies to every day (OSM semantics).
    const dm = /^([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)\s+(.+)$/.exec(rule);
    let dayIdx: number[] | null;
    let timePart: string;
    if (dm?.[1] && dm[2]) {
      dayIdx = parseDays(dm[1]);
      timePart = dm[2].trim();
      if (dayIdx == null) continue; // unmodelled day selector -> skip (unknown)
    } else if (/^(24\/7|off|closed|sunrise|sunset|dawn|dusk|\d)/i.test(rule)) {
      dayIdx = [0, 1, 2, 3, 4, 5, 6]; // no day token -> all days
      timePart = rule;
    } else {
      continue; // unrecognised rule shape
    }

    let dh: DayHours | null = null;
    if (/^(off|closed)$/i.test(timePart)) {
      dh = { kind: "closed" };
    } else if (/^24\/7$/i.test(timePart)) {
      dh = { kind: "h24" };
    } else {
      const tm = /^(\S+)\s*-\s*(\S+)$/.exec(timePart);
      const o = tm?.[1];
      const c = tm?.[2];
      if (o && c) {
        const open = timeBoundary(o, coords);
        const close = timeBoundary(c, coords);
        if (open && close) dh = { kind: "window", open, close };
      }
    }
    if (!dh) continue; // could not resolve this rule -> leave those days unknown

    matchedAnything = true;
    for (const i of dayIdx) days[i] = dh; // later rules override earlier
  }

  if (!matchedAnything) return null;
  return days.map((d) => d ?? { kind: "unknown" });
}
