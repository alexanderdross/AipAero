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
 * Times are the field's **LOCAL wall clock** (minutes after local midnight),
 * paired with the field's IANA `tz`. Rationale: the AIP prints a winter/summer
 * pair "0500 (0400)", which is one CONSTANT local time (06:00 here) shifted by
 * DST - so storing the local number + evaluating in `tz` is season-correct all
 * year, where a single stored UTC value drifts ~1 h in the opposite season (the
 * unsafe direction - it can over-state the close). The UI labels these `LT`.
 * Solar limits are stored as the `sr`/`ss` boundary, which resolves to the
 * field's real sunrise/sunset in that same zone (so that half tracks the season
 * exactly too).
 *
 * Key: ICAO (uppercase). Value: `{ hours, tz }` where `hours` is a 7-element
 * `StructuredHours` (index 0 = Monday .. 6 = Sunday) in local minutes and `tz`
 * is the IANA zone those minutes are in. Absent = no override, the merged
 * OCR/eAIP/OpenAIP value applies.
 */

export interface HoursOverride {
  hours: StructuredHours;
  /** IANA zone the stored clock minutes are expressed in (e.g. "Europe/Berlin"). */
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

// EDNY Friedrichshafen - DFS AIP AD 2.3 (verified against the official
// operating-hours notice, bodensee-airport.eu / AD 2.3, 20.07.2026):
//   MON-FRI     0500-2100Z winter / 0400-2000Z summer = 06:00-22:00 LOCAL
//   SAT/SUN/HOL 0800Z winter / 0700Z summer = 09:00 LOCAL .. SS+30 (~max 1900Z)
// Stored in LOCAL minutes + Europe/Berlin so the constant local clock is
// season-correct (the OCR read the weekend "SS" as "$8" and dropped it; this
// pins it). Weekend close = sunset, which resolves to the real local SS (the
// "MAX 1900Z" cap is above EDNY's sunset except a few midsummer weeks, so `ss`
// is the faithful bound).
const EDNY_TZ = "Europe/Berlin";
const EDNY_WEEKDAY = win(6 * 60, 22 * 60); // 06:00-22:00 LT
const EDNY_WEEKEND = winToSunset(9 * 60); // 09:00 LT - sunset

export const hoursOverrides: Record<string, HoursOverride> = {
  EDNY: {
    tz: EDNY_TZ,
    hours: [
      EDNY_WEEKDAY,
      EDNY_WEEKDAY,
      EDNY_WEEKDAY,
      EDNY_WEEKDAY,
      EDNY_WEEKDAY,
      EDNY_WEEKEND,
      EDNY_WEEKEND,
    ],
  },
};

/** Verified structured-hours override for an ICAO, or null when none exists. */
export function hoursOverride(
  icao: string | null | undefined,
): HoursOverride | null {
  if (!icao) return null;
  return hoursOverrides[icao.toUpperCase()] ?? null;
}
