import type { DayHours, StructuredHours } from "~/lib/opening-hours";
import { isDstActive } from "~/lib/opening-hours";

/**
 * Verified operating-hours overrides, beyond the automatic OCR / eAIP / OpenAIP
 * sources.
 *
 * The automatic sources can be wrong or incomplete - most notably the DE DFS
 * AD-2 is only reachable via OCR, which garbles tokens (e.g. a sunset "SS" read
 * as "$8", dropping the weekend window). This map lets the owner pin the
 * VERIFIED structured hours for a field, read from that field's AIP **AD 2.3**
 * ("Operational hours"); the entry WINS over every other source at read time
 * (the detail-page badge / weekday table / JSON-LD AND the map filter), same
 * contract as `customs-overrides.ts`. A wrong operating-hours claim is a safety
 * hazard, so ONLY add entries verified against the field's AIP AD 2.3.
 *
 * Times are **UTC** (the AIP AD 2.3 convention; the whole site shows UTC/Zulu).
 * Daylight saving: an AD 2.3 window that shifts with summer time is published as
 * a UTC pair "0500 (0400)" (bracket = summer). Where that applies, an entry
 * stores the `winter` (base) AND `summer` UTC windows; `resolveOverrideHours`
 * picks the season active at read time (`isDstActive` on the field's `tz`) and
 * returns plain UTC `StructuredHours`. The `tz` is used ONLY for that seasonal
 * pick - never to display a local wall clock. A field with no summer variation
 * omits `summer` (the winter window always applies). Solar limits stay the
 * `sr`/`ss` boundary, which resolves to the field's real sunrise/sunset UTC.
 *
 * Key: ICAO (uppercase). Absent = no override, the merged OCR/eAIP/OpenAIP value
 * applies.
 */

export interface HoursOverride {
  /** Winter / standard-time UTC windows (the AIP base value). */
  winter: StructuredHours;
  /** Summer-time UTC windows, when the AIP publishes a seasonal pair. */
  summer?: StructuredHours;
  /** IANA zone used ONLY to decide winter vs summer (never to display local). */
  tz: string;
}

const win = (openMin: number, closeMin: number): DayHours => ({
  kind: "window",
  open: { t: "time", m: openMin },
  close: { t: "time", m: closeMin },
});
const winToSunset = (openMin: number): DayHours => ({
  kind: "window",
  open: { t: "time", m: openMin },
  close: { t: "ss" },
});

const week = (weekday: DayHours, weekend: DayHours): StructuredHours => [
  weekday,
  weekday,
  weekday,
  weekday,
  weekday,
  weekend,
  weekend,
];

// EDNY Friedrichshafen - DFS AIP AD 2.3 (verified against the official
// operating-hours notice, bodensee-airport.eu / AD 2.3, 20.07.2026):
//   MON-FRI     0500-2100Z winter / 0400-2000Z summer  (= 06:00-22:00 local)
//   SAT/SUN/HOL 0800Z winter / 0700Z summer .. SS+30    (= 09:00 local .. sunset)
// Stored as the two UTC seasons; the site shows the season active now, all UTC.
// Weekend close = sunset (astronomical, already season-correct). The OCR read the
// weekend "SS" as "$8" and dropped it; this pins it.
const hoursOverrides: Record<string, HoursOverride> = {
  EDNY: {
    tz: "Europe/Berlin",
    winter: week(win(5 * 60, 21 * 60), winToSunset(8 * 60)), // 0500-2100Z / 0800Z-SS
    summer: week(win(4 * 60, 20 * 60), winToSunset(7 * 60)), // 0400-2000Z / 0700Z-SS
  },
};

/** The verified override entry for an ICAO, or null when none exists. */
export function hoursOverride(
  icao: string | null | undefined,
): HoursOverride | null {
  if (!icao) return null;
  return hoursOverrides[icao.toUpperCase()] ?? null;
}

/**
 * The verified override's UTC `StructuredHours` for the season active at `when`
 * (summer when DST is in effect in the field's zone and a summer window exists,
 * else the winter/base window), or null when the field has no override. The
 * result is plain UTC minutes - the caller evaluates and labels it as UTC.
 */
export function resolveOverrideHours(
  icao: string | null | undefined,
  when: Date = new Date(),
): StructuredHours | null {
  const ov = hoursOverride(icao);
  if (!ov) return null;
  if (ov.summer && isDstActive(ov.tz, when)) return ov.summer;
  return ov.winter;
}
