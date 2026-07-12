/**
 * Verified customs / Airport-of-Entry overrides beyond OpenAIP.
 *
 * OpenAIP's customs flag is community-sourced; the authoritative source is
 * each country's AIP **GEN 1.2** (entry, transit and departure of aircraft),
 * which lists the designated international / customs aerodromes. Entries in
 * this map are ONLY added after checking the national GEN 1.2 (via the
 * self-hosted runner - the sandboxed dev environment has no egress to the
 * AIP hosts) and they take precedence over every other source at read time:
 * a wrong customs answer is a compliance hazard for the pilot, same policy
 * as the border-crossing form links (`border-crossing.ts`).
 *
 * Key: ICAO code (uppercase). Value: true = customs available (possibly on
 * request / with prior notice - the pilot must still check the AIP entry),
 * false = verified NOT a customs aerodrome. Absent = no override, the
 * merged OpenAIP/D1 value applies. Keep a source note per entry.
 *
 * Verification runbook: docs/data-backfill-runbook.md ("Customs overrides").
 */
export const customsOverrides: Record<string, boolean> = {
  // Seeded per country from the national AIP GEN 1.2 after live
  // verification on the runner - intentionally empty until then.
};

/** Verified override for an ICAO, or undefined when none exists. */
export function customsOverride(
  icao: string | null | undefined,
): boolean | undefined {
  if (!icao) return undefined;
  return customsOverrides[icao.toUpperCase()];
}
