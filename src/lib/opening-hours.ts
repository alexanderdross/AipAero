// Structured, queryable aerodrome operation hours - the single source of truth
// for the "open now / open until X" feature (docs/operation-hours-concept.md).
//
// PURE and dependency-light (only `sun-times`, itself pure): NO `server-only`,
// NO env, NO network - so it runs BOTH server-side (the detail-page badge, the
// OpenAIP display-string builder) AND client-side (the airport-list map filter),
// and is unit-testable. A Python twin lives at
// `crawlers/crawlers/operating_hours.py` (shared test vectors) for the eAIP
// AD 2.3 crawler path.
//
// Times are stored as MINUTES AFTER LOCAL MIDNIGHT (0..1439). Field local time
// is approximated from LONGITUDE (15deg = 1h), the same solar basis
// `sun-times.ts` uses - it ignores political timezone boundaries and DST. This
// is acceptable under the feature's advisory framing ("confirm via NOTAM/AIP");
// a precise IANA-timezone lookup is a documented future refinement.

import { getSunTimes } from "~/lib/sun-times";

// One boundary of a day's opening window: a fixed clock time, or a solar event
// (resolved per-day from coordinates at read time).
export type Boundary =
  | { t: "time"; m: number } // minutes after local midnight
  | { t: "sr" } // sunrise
  | { t: "ss" }; // sunset

// One day's operation state. `window` carries an open+close boundary; the rest
// are whole-day states. `unknown` (source silent) and `notam` (by NOTAM) are
// deliberately NOT assertable as open - the "open" filters exclude them.
export type DayHours =
  | { kind: "window"; open: Boundary; close: Boundary }
  | { kind: "h24" }
  | { kind: "closed" }
  | { kind: "notam" }
  | { kind: "unknown" };

// Seven entries, index 0 = Monday .. 6 = Sunday (matching OpenAIP `dayOfWeek`).
export type StructuredHours = DayHours[];

export interface ResolvedStatus {
  state: "open" | "closed" | "unknown";
  // When open: the local minute the field closes (undefined for h24).
  closesAt?: number;
  // When closed but opening later the same local day: the local opening minute.
  opensAt?: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "HH:MM" (or a longer time string) -> minutes after midnight, else null.
function hhmmMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// minutes-after-midnight -> "HH:MM" (24h). 1440 (end-of-day) renders as 24:00.
export function minutesToHhmm(min: number): string {
  const m = ((Math.round(min) % 1441) + 1441) % 1441;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

// -------- OpenAIP structured parse (mirrors parseOpeningHours' extraction) -----

function fixedBoundary(minutes: number | null): Boundary | null {
  return minutes == null ? null : { t: "time", m: minutes };
}

function openAipDay(e: Record<string, unknown>): DayHours {
  if (e.byNotam === true) return { kind: "notam" };
  const open: Boundary | null =
    e.sunrise === true ? { t: "sr" } : fixedBoundary(hhmmMinutes(e.startTime));
  const close: Boundary | null =
    e.sunset === true ? { t: "ss" } : fixedBoundary(hhmmMinutes(e.endTime));
  if (!open || !close) return { kind: "unknown" };
  return { kind: "window", open, close };
}

/**
 * OpenAIP `hoursOfOperation` -> `StructuredHours` (7 days, Mon..Sun). Days the
 * source does not mention become `unknown` (we do not assert "closed" from
 * silence). Returns null when there is no usable `operatingHours` array (the
 * caller then falls back to the free-text `remarks` string, see openaip-parse).
 * Schema: `{ operatingHours: [{ dayOfWeek 0..6, startTime?, endTime?, sunrise,
 * sunset, byNotam }], remarks? }`.
 */
export function parseStructuredHours(raw: unknown): StructuredHours | null {
  if (!raw || typeof raw !== "object") return null;
  const entries = (raw as Record<string, unknown>).operatingHours;
  if (!Array.isArray(entries)) return null;
  const days: (DayHours | undefined)[] = new Array<DayHours | undefined>(
    7,
  ).fill(undefined);
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const d = e.dayOfWeek;
    if (typeof d !== "number" || d < 0 || d > 6) continue;
    if (days[d]) continue; // first entry for a day wins (matches display parse)
    days[d] = openAipDay(e);
  }
  if (days.every((d) => d === undefined)) return null;
  return days.map((d) => d ?? { kind: "unknown" });
}

// -------- Display string (the human row) -------------------------------------

// One day's compact window string, or null when it should be omitted from the
// display (closed / unknown), matching the legacy `parseOpeningHours` output.
function dayDisplay(dh: DayHours): string | null {
  switch (dh.kind) {
    case "notam":
      return "by NOTAM";
    case "h24":
      return "H24";
    case "window": {
      const b = (x: Boundary) =>
        x.t === "sr" ? "SR" : x.t === "ss" ? "SS" : minutesToHhmm(x.m);
      return `${b(dh.open)}-${b(dh.close)}`;
    }
    default:
      return null; // closed / unknown -> omitted
  }
}

/**
 * Compact display string from structured hours, grouping consecutive days that
 * share the same window: "Mon-Fri 08:00-20:00; Sat SR-SS". This is the exact
 * shape the old `parseOpeningHours` produced, now derived from the structured
 * form so the string and the structure never diverge.
 */
export function structuredHoursToDisplay(
  hours: StructuredHours,
): string | null {
  const byDay = new Map<number, string>();
  hours.forEach((dh, d) => {
    const w = dayDisplay(dh);
    if (w) byDay.set(d, w);
  });
  if (byDay.size === 0) return null;
  const parts: string[] = [];
  let runStart: number | null = null;
  for (let d = 0; d <= 7; d++) {
    const w = d <= 6 ? byDay.get(d) : undefined;
    const prev = d > 0 ? byDay.get(d - 1) : undefined;
    if (w && w === prev) continue; // extend current run
    if (runStart != null && prev) {
      const label =
        runStart === d - 1
          ? DAY_LABELS[runStart]
          : `${DAY_LABELS[runStart]}-${DAY_LABELS[d - 1]}`;
      parts.push(`${label} ${prev}`);
    }
    runStart = w ? d : null;
  }
  return parts.length ? parts.join("; ") : null;
}

// -------- Local-time resolution ----------------------------------------------

// Approximate the field's local wall clock from UTC + longitude (15deg = 1h).
// Returns the local day-of-week (0 = Mon) and minute-of-day.
function localParts(when: Date, lon: number): { dow: number; minute: number } {
  const offsetMs = Math.round((lon / 15) * 3600) * 1000;
  const local = new Date(when.getTime() + offsetMs);
  const dow = (local.getUTCDay() + 6) % 7; // JS Sun=0 -> our Mon=0
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return { dow, minute };
}

// A UTC instant (e.g. a sunrise/sunset Date) -> local minute-of-day at `lon`.
function utcToLocalMinute(d: Date, lon: number): number {
  const offsetMs = Math.round((lon / 15) * 3600) * 1000;
  const local = new Date(d.getTime() + offsetMs);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

// Resolve one boundary to a concrete local minute-of-day, or null when a solar
// event does not occur (polar day/night) and we cannot know it.
function resolveBoundary(
  b: Boundary,
  coords: { lat: number; lon: number } | null,
  when: Date,
): number | null {
  if (b.t === "time") return b.m;
  if (!coords) return null;
  const sun = getSunTimes(when, coords.lat, coords.lon);
  const evt = b.t === "sr" ? sun.sunrise : sun.sunset;
  return evt ? utcToLocalMinute(evt, coords.lon) : null;
}

// Resolve a day's window to [open, close] local minutes, or null when it cannot
// be resolved to a concrete, forward-going window.
function resolveWindow(
  dh: DayHours,
  coords: { lat: number; lon: number } | null,
  when: Date,
): { open: number; close: number } | null {
  if (dh.kind === "h24") return { open: 0, close: 1440 };
  if (dh.kind !== "window") return null;
  const open = resolveBoundary(dh.open, coords, when);
  const close = resolveBoundary(dh.close, coords, when);
  if (open == null || close == null) return null;
  if (close <= open) return null; // wrap/degenerate window - treat as unknown
  return { open, close };
}

/**
 * The field's operation state at `when` (default now), from its structured
 * hours. `unknown`/`notam` days and unresolvable windows yield `state:"unknown"`
 * so the UI shows no misleading "open"/"closed" claim.
 */
export function openStatus(
  hours: StructuredHours | null | undefined,
  coords: { lat: number; lon: number } | null,
  when: Date = new Date(),
): ResolvedStatus {
  if (!hours || hours.length !== 7) return { state: "unknown" };
  const { dow, minute } = localParts(when, coords?.lon ?? 0);
  const dh = hours[dow];
  if (!dh || dh.kind === "unknown" || dh.kind === "notam")
    return { state: "unknown" };
  if (dh.kind === "closed") return { state: "closed" };
  const win = resolveWindow(dh, coords, when);
  if (!win) return { state: "unknown" };
  if (minute >= win.open && minute < win.close)
    return {
      state: "open",
      ...(dh.kind === "h24" ? {} : { closesAt: win.close }),
    };
  if (minute < win.open) return { state: "closed", opensAt: win.open };
  return { state: "closed" };
}

/**
 * Is the field still open UNTIL `targetMinutes` local on the local day of
 * `when`? i.e. it opens at or before the target and does not close before it
 * (inclusive close: a field closing exactly at 19:00 counts as "open until
 * 19:00"). Backs the map "open until [time]" filter. Conservative: a day that is
 * `unknown`/`notam`/`closed`, or whose window cannot be resolved, is NEVER
 * counted as open.
 */
export function isOpenUntil(
  hours: StructuredHours | null | undefined,
  coords: { lat: number; lon: number } | null,
  targetMinutes: number,
  when: Date = new Date(),
): boolean {
  if (!hours || hours.length !== 7) return false;
  const { dow } = localParts(when, coords?.lon ?? 0);
  const dh = hours[dow];
  if (!dh || (dh.kind !== "window" && dh.kind !== "h24")) return false;
  const win = resolveWindow(dh, coords, when);
  if (!win) return false;
  return targetMinutes >= win.open && targetMinutes <= win.close;
}

// -------- schema.org openingHoursSpecification --------------------------------

const SCHEMA_DAY = [
  "https://schema.org/Monday",
  "https://schema.org/Tuesday",
  "https://schema.org/Wednesday",
  "https://schema.org/Thursday",
  "https://schema.org/Friday",
  "https://schema.org/Saturday",
  "https://schema.org/Sunday",
];

export interface OpeningHoursSpecification {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

// A day reduced to a fixed "HH:MM"-"HH:MM" pair for schema.org, or null when it
// has no assertable fixed window (solar / notam / unknown / closed are omitted -
// schema.org has no sunrise/sunset primitive and we never assert unverified).
function schemaWindow(dh: DayHours): { opens: string; closes: string } | null {
  if (dh.kind === "h24") return { opens: "00:00", closes: "23:59" };
  if (dh.kind !== "window") return null;
  if (dh.open.t !== "time" || dh.close.t !== "time") return null;
  return { opens: minutesToHhmm(dh.open.m), closes: minutesToHhmm(dh.close.m) };
}

/**
 * schema.org `openingHoursSpecification` from structured hours, grouping days
 * that share the same fixed window into one spec. Sun-relative / NOTAM / unknown
 * days are omitted (the human string still shows them). Empty array -> caller
 * omits the property entirely.
 */
export function toOpeningHoursSpecification(
  hours: StructuredHours | null | undefined,
): OpeningHoursSpecification[] {
  if (!hours || hours.length !== 7) return [];
  const byWindow = new Map<
    string,
    { spec: { opens: string; closes: string }; days: string[] }
  >();
  hours.forEach((dh, d) => {
    const w = schemaWindow(dh);
    if (!w) return;
    const key = `${w.opens}-${w.closes}`;
    const entry = byWindow.get(key) ?? { spec: w, days: [] };
    entry.days.push(SCHEMA_DAY[d]!);
    byWindow.set(key, entry);
  });
  return [...byWindow.values()].map((e) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: e.days,
    opens: e.spec.opens,
    closes: e.spec.closes,
  }));
}
