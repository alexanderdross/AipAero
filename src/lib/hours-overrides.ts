import type { DayHours, StructuredHours } from "~/lib/opening-hours";

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
 * Times are **UTC** (the AIP AD 2.3 convention; the site displays UTC/Zulu
 * throughout). Where the AIP prints a winter/summer pair "0500 (0400)", we store
 * the non-bracketed (winter) value - the AIP's primary listing - and rely on the
 * always-visible "advisory, confirm before flight" note for the <= 1 h seasonal
 * (DST) drift a single UTC window cannot express. Solar limits are stored as the
 * `sr`/`ss` boundary, which resolves to the field's real sunrise/sunset UTC (so
 * that half tracks the season exactly).
 *
 * Key: ICAO (uppercase). Value: a 7-element `StructuredHours` (index 0 = Monday
 * .. 6 = Sunday). Absent = no override, the merged OCR/eAIP/OpenAIP value applies.
 */

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

// EDNY Friedrichshafen - DFS AIP AD 2.3 (verified against the official
// operating-hours notice, bodensee-airport.eu / AD 2.3, 20.07.2026):
//   MON-FRI     0500-2100Z (winter; 0400-2000Z summer) = 06:00-22:00 local
//   SAT/SUN/HOL 0800Z (0700Z summer) = 09:00 local .. SS+30 (max ~1900Z)
// The OCR read the weekend "SS" as "$8", so it dropped the SAT/SUN window; this
// pins it. Close = sunset (resolves to real SS UTC; the "MAX 1900" cap is above
// EDNY's sunset for all but a few midsummer weeks, so `ss` is the faithful bound).
const EDNY_WEEKDAY = win(5 * 60, 21 * 60); // 05:00-21:00Z
const EDNY_WEEKEND = winToSunset(8 * 60); // 08:00Z - sunset

export const hoursOverrides: Record<string, StructuredHours> = {
  EDNY: [
    EDNY_WEEKDAY,
    EDNY_WEEKDAY,
    EDNY_WEEKDAY,
    EDNY_WEEKDAY,
    EDNY_WEEKDAY,
    EDNY_WEEKEND,
    EDNY_WEEKEND,
  ],
};

/** Verified structured-hours override for an ICAO, or null when none exists. */
export function hoursOverride(
  icao: string | null | undefined,
): StructuredHours | null {
  if (!icao) return null;
  return hoursOverrides[icao.toUpperCase()] ?? null;
}
