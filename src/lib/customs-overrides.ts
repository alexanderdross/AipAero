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

  // ---------------------------------------------------------------------
  // NL - LVNL eAIP AD 1.3 (verified on the runner 13.07.2026, gen12
  // recon, AIRAC AMDT 07-2026): fields designated INTL/NTL are the
  // official border-crossing points per GEN 1.2 para 4.3 (Schengen
  // external border); NTL fields are "Schengen Treaty countries only"
  // and deliberately carry no entry here.
  EHAM: true, // AMSTERDAM/Schiphol
  EHHA: true, // Amsterdam Heliport
  EHSE: true, // BREDA/Seppe
  EHKD: true, // Den HELDER/De Kooy
  EHHE: true, // Eemshaven Heliport
  EHEH: true, // EINDHOVEN/Eindhoven
  EHTW: true, // ENSCHEDE/Twente
  EHGG: true, // GRONINGEN/Eelde
  EHHO: true, // HOOGEVEEN/Hoogeveen
  EHLE: true, // LELYSTAD/Lelystad
  EHBK: true, // MAASTRICHT/Maastricht Aachen
  EHMZ: true, // MIDDELBURG/Midden-Zeeland
  EHRD: true, // ROTTERDAM/Rotterdam
  EHTX: true, // TEXEL/Texel
  EHBD: true, // WEERT/Budel

  // ---------------------------------------------------------------------
  // FR - SIA eAIP AD 1.3 (verified on the runner 13.07.2026, gen12
  // recon, AIRAC 2026-07-09): the "Trafic" column designates these 85
  // fields INTL (international traffic permitted = customs/police
  // controls available - GEN 1.2: first landing must be at an airport
  // with customs control). Many provincial fields provide customs on
  // request / seasonally (PPR douane) - true here means "check the AD 2
  // entry for the notice period", per this map's contract. NTL fields
  // carry no entry.
  LFOI: true, // Abbeville
  LFBA: true, // Agen La Garenne
  LFKJ: true, // Ajaccio Napoleon Bonaparte
  LFAQ: true, // Albert Bray
  LFCI: true, // Albi Le Sequestre
  LFAY: true, // Amiens-glisy
  LFJR: true, // Angers Marce
  LFBU: true, // Angouleme Brie Champniers
  LFMV: true, // Avignon Caumont
  LFSB: true, // Bale-mulhouse
  LFKB: true, // Bastia Poretta
  LFOB: true, // Beauvais Tille
  LFBE: true, // Bergerac Dordogne Perigord
  LFMU: true, // Beziers Vias
  LFBZ: true, // Biarritz Pays Basque
  LFHB: true, // Biscarrosse Hydrobase
  LFOQ: true, // Blois Le Breuil
  LFBD: true, // Bordeaux Merignac
  LFLD: true, // Bourges
  LFRB: true, // Brest Bretagne
  LFSL: true, // Brive Souillac
  LFRK: true, // Caen Carpiquet
  LFCC: true, // Cahors Lalbenque
  LFAC: true, // Calais Dunkerque
  LFKC: true, // Calvi Sainte Catherine
  LFMD: true, // Cannes Mandelieu
  LFMK: true, // Carcassonne Salvaza
  LFCK: true, // Castres Mazamet
  LFOK: true, // Chalons Vatry
  LFLB: true, // Chambery Aix Les Bains
  LFLX: true, // Chateauroux Deols
  LFRC: true, // Cherbourg Manche
  LFLC: true, // Clermont Ferrand Auvergne
  LFLJ: true, // Courchevel
  LFRG: true, // Deauville Normandie
  LFAB: true, // Dieppe Saint Aubin
  LFSD: true, // Dijon-longvic
  LFRD: true, // Dinard Pleurtuit Saint Malo
  LFGJ: true, // Dole Tavaux
  LFSG: true, // Epinal Mirecourt
  LFKF: true, // Figari Sud Corse
  LFNA: true, // Gap Tallard
  LFLS: true, // Grenoble Alpes Isere
  LFSH: true, // Haguenau
  LFTH: true, // Hyeres Le Palyvestre
  LFTZ: true, // La Mole
  LFBH: true, // La Rochelle Ile De Re
  LFOH: true, // Le Havre Octeville
  LFAT: true, // Le Touquet Elizabeth Ii
  LFQQ: true, // Lille Lesquin
  LFBL: true, // Limoges Bellegarde
  LFPL: true, // Lognes Emerainville
  LFRH: true, // Lorient Lann Bihoue
  LFLY: true, // Lyon Bron
  LFLL: true, // Lyon Saint Exupery
  LFTB: true, // Marignane Berre
  LFML: true, // Marseille Provence
  LFHM: true, // Megeve
  LFJL: true, // Metz Nancy Lorraine
  LFMT: true, // Montpellier Mediterranee
  LFRU: true, // Morlaix Ploujean
  LFSN: true, // Nancy Essey
  LFRS: true, // Nantes Atlantique
  LFMN: true, // Nice Cote D'azur
  LFTW: true, // Nimes Garons
  LFOZ: true, // Orleans Saint Denis De L'hotel
  LFPG: true, // Paris Charles De Gaulle
  LFPB: true, // Paris Le Bourget
  LFPO: true, // Paris Orly
  LFBP: true, // Pau Pyrenees
  LFBX: true, // Perigueux Bassillac
  LFMP: true, // Perpignan Rivesaltes
  LFBI: true, // Poitiers Biard
  LFRQ: true, // Quimper Pluguffan
  LFRN: true, // Rennes Saint Jacques
  LFCR: true, // Rodez Aveyron
  LFOP: true, // Rouen Vallee De Seine
  LFRT: true, // Saint Brieuc Armor
  LFMH: true, // Saint Etienne Loire
  LFST: true, // Strasbourg Entzheim
  LFBT: true, // Tarbes Lourdes Pyrenees
  LFBO: true, // Toulouse Blagnac
  LFOT: true, // Tours Val De Loire
  LFAV: true, // Valenciennes Denain
  LFLV: true, // Vichy Charmeil
  // ---------------------------------------------------------------------
  // CZ - ANS CR eAIP AD 1.3 (verified on the runner 13.07.2026, gen12
  // recon): fields designated INTL-NTL; the ~136 NTL fields carry no
  // entry. Includes the VFR-manual fields with INTL designation (customs
  // on request - check the VFR manual entry).
  LKBE: true, // Benešov
  LKCH: true, // Chomutov
  LKCS: true, // České Budějovice
  LKHB: true, // Havlíčkův Brod
  LKHK: true, // Hradec Králové
  LKKU: true, // Kunovice
  LKKV: true, // Karlovy Vary
  LKLB: true, // Liberec
  LKLN: true, // Plzeň / Líně
  LKLT: true, // Letňany
  LKMH: true, // Mnichovo Hradiště
  LKMT: true, // Ostrava / Mošnov
  LKPD: true, // Pardubice
  LKPO: true, // Přerov
  LKPR: true, // Praha / Ruzyně
  LKRO: true, // Roudnice
  LKTB: true, // Brno / Tuřany
  LKTC: true, // Točná
  LKVM: true, // Vysoké Mýto
  LKVO: true, // Praha / Vodochody

  // ---------------------------------------------------------------------
  // SE - LFV eAIP AD 1.3 (verified on the runner 13.07.2026, gen12
  // recon, AIRAC AMDT 4-2026): fields designated INTL-NTL; the ~146 NTL
  // fields carry no entry.
  ESCM: true, // Uppsala
  ESDF: true, // Ronneby
  ESGG: true, // Göteborg / Landvetter
  ESGJ: true, // Jönköping
  ESGP: true, // Göteborg / Säve
  ESGT: true, // Göteborg / Stallbacka
  ESKN: true, // Stockholm / Skavsta
  ESKS: true, // Sälen / Scandinavian Mountains
  ESMK: true, // Kristianstad
  ESMQ: true, // Kalmar
  ESMS: true, // Malmö
  ESMT: true, // Halmstad
  ESMX: true, // Växjö / Kronoberg
  ESNF: true, // Åviken / Åviken Fly Camp
  ESNN: true, // Sundsvall-timrå
  ESNO: true, // Örnsköldsvik
  ESNQ: true, // Kiruna
  ESNS: true, // Skellefteå
  ESNU: true, // Umeå
  ESNX: true, // Arvidsjaur
  ESNZ: true, // Åre Östersund
  ESOE: true, // Örebro
  ESOK: true, // Karlstad
  ESOW: true, // Stockholm / Västerås
  ESPA: true, // Luleå / Kallax
  ESSA: true, // Stockholm / Arlanda
  ESSB: true, // Stockholm / Bromma
  ESSD: true, // Borlänge
  ESSL: true, // Linköping / Saab
  ESSP: true, // Norrköping / Kungsängen
  ESSU: true, // Eskilstuna
  ESSV: true, // Visby
  ESTA: true, // Ängelholm
  ESUP: true, // Pajala
};

/** Verified override for an ICAO, or undefined when none exists. */
export function customsOverride(
  icao: string | null | undefined,
): boolean | undefined {
  if (!icao) return undefined;
  return customsOverrides[icao.toUpperCase()];
}
