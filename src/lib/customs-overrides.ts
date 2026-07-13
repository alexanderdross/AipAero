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
  // ---------------------------------------------------------------------
  // UK - NATS eAIP GEN 1.2, AIRAC 2026-07-09 (verified on the runner
  // 13.07.2026 via the crawler-live-test `gen12` recon): the Border Force
  // port office table lists every designated customs port. Fields whose
  // row says "refer to Border Force contact for <other airport>" are
  // still designated ports (clearance is handled by that office; the
  // pilot files the GAR as usual), so they are true like the rest.
  EGPD: true, // Aberdeen
  EGAA: true, // Belfast International
  EGBB: true, // Birmingham
  EGLK: true, // Blackbushe (via Farnborough office)
  EGNH: true, // Blackpool
  EGGD: true, // Bristol
  EGSC: true, // Cambridge
  EGFF: true, // Cardiff
  EGLD: true, // Denham (via Farnborough office)
  EGNX: true, // East Midlands
  EGPH: true, // Edinburgh
  EGTR: true, // Elstree (via Farnborough office)
  EGTE: true, // Exeter
  EGTF: true, // Fairoaks (via Farnborough office)
  EGLF: true, // Farnborough
  EGKK: true, // Gatwick
  EGPF: true, // Glasgow
  EGLL: true, // Heathrow
  EGNJ: true, // Humberside
  EGPE: true, // Inverness (via Aberdeen office)
  EGNM: true, // Leeds Bradford
  EGGP: true, // Liverpool
  EGLC: true, // London City
  EGGW: true, // Luton
  EGCC: true, // Manchester
  EGNT: true, // Newcastle
  EGSH: true, // Norwich
  EGTK: true, // Oxford (via RAF Brize Norton office)
  EGPK: true, // Prestwick
  EGVN: true, // RAF Brize Norton
  EGWU: true, // RAF Northolt
  EGHI: true, // Southampton
  EGMC: true, // Southend
  EGSS: true, // Stansted
  EGNV: true, // Teesside International
  EGLM: true, // White Waltham (via Farnborough office)
  EGTB: true, // Wycombe Air Park / Booker (via Farnborough office)

  // ---------------------------------------------------------------------
  // BE/LUX - skeyes eAIP GEN 1.2 + AD 1.3 (verified on the runner
  // 13.07.2026, gen12 recon): the AD 1.3 aerodrome index designates
  // exactly these fields INTL (international traffic permitted); the very
  // same set appears in GEN 1.2 as the points of entry. All other Belgian
  // fields (military/private/ULM) are NTL and deliberately carry NO entry
  // here (absent = the merged OpenAIP/D1 value applies). EBMB (Melsbroek)
  // is listed for VIP flights only - not a GA point of entry, no entry.
  EBAW: true, // Antwerpen / Deurne
  EBBR: true, // Brussels-National
  EBCI: true, // Charleroi / Brussels South
  EBKT: true, // Kortrijk / Wevelgem
  EBLG: true, // Liege
  EBOS: true, // Oostende-Brugge
  ELLX: true, // Luxembourg (published in the skeyes AIP)

  // ---------------------------------------------------------------------
  // NO - Avinor eAIP AD 1.3 (verified on the runner 13.07.2026, gen12
  // recon, AIRAC 2026-06-11): the aerodrome index designates these INTL.
  // Norway is outside the EU customs union, so the INTL designation is
  // the customs-relevant point-of-entry list; the remaining 37 fields are
  // NTL and carry no entry here.
  ENAT: true, // Alta
  ENBR: true, // Bergen / Flesland
  ENBO: true, // Bodo
  ENEV: true, // Harstad/Narvik / Evenes
  ENHD: true, // Haugesund / Karmoy
  ENEG: true, // Honefoss / Eggemoen
  ENKR: true, // Kirkenes / Hoybuktmoen
  ENCN: true, // Kristiansand / Kjevik
  ENKB: true, // Kristiansund / Kvernberget
  ENML: true, // Molde / Aro
  ENGM: true, // Oslo / Gardermoen
  ENRY: true, // Rygge
  ENRO: true, // Roros
  ENTO: true, // Sandefjord / Torp
  ENZV: true, // Stavanger / Sola
  ENTC: true, // Tromso / Langnes
  ENVA: true, // Trondheim / Vaernes
  ENAL: true, // Alesund / Vigra
};

/** Verified override for an ICAO, or undefined when none exists. */
export function customsOverride(
  icao: string | null | undefined,
): boolean | undefined {
  if (!icao) return undefined;
  return customsOverrides[icao.toUpperCase()];
}
