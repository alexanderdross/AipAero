/**
 * Verified traffic-circuit (Platzrunde) direction overrides, per runway.
 *
 * Circuit direction is NOT reliably available from our automatic sources:
 * OpenAIP's per-runway `turnDirection` is frequently empty (e.g. EDNY, EDFZ),
 * and the DFS AD-2 publishes the circuit GRAPHICALLY on the Sichtflugkarte
 * (loops + directional arrows), not as parseable text - so OCR cannot read it
 * (OCR extracts text, not arrow geometry). This map lets the owner pin the
 * VERIFIED circuit direction for a runway, read off the field's Sichtflugkarte
 * / AD 2.20; it takes precedence over OpenAIP at read time (merged into
 * `RunwayFact.trafficPattern`), same contract as `customs-overrides.ts` /
 * `hours-overrides.ts`. A wrong left/right is a safety hazard, so ONLY add
 * entries verified against the official chart - never guessed.
 *
 * Key: ICAO (uppercase). Value: a map from the runway IDENT exactly as it
 * appears in `RunwayFact.ident` (e.g. "07/25" or "07R/25L") to "left" |
 * "right". Absent = no override, the OpenAIP value (or none) applies.
 *
 * Limitation: `RunwayFact` carries one direction per physical runway (per
 * ident), matching the current model + OpenAIP, so a field whose two ends run
 * opposite hands cannot be fully expressed here. Seeded EMPTY like
 * `customs-overrides.ts` - the owner adds verified entries.
 */
export const circuitOverrides: Record<
  string,
  Record<string, "left" | "right">
> = {
  // Seeded empty. Add ONLY entries verified against the field's Sichtflugkarte
  // / AD 2.20. Example shape (do NOT enable without verifying on the chart):
  //   EDFZ: { "07/25": "right" },
};

/**
 * Verified circuit direction for a runway ident at an ICAO, or null when there
 * is no override. `ident` is matched against `RunwayFact.ident` (trimmed).
 */
export function circuitOverride(
  icao: string | null | undefined,
  ident: string | null | undefined,
): "left" | "right" | null {
  if (!icao || !ident) return null;
  const byRunway = circuitOverrides[icao.toUpperCase()];
  if (!byRunway) return null;
  return byRunway[ident.trim()] ?? null;
}
