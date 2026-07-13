# GEN 1.2 / AD 1.3 customs recon - batch 1 (EE FI LV IS PT HU ES)

Source: GitHub Actions run 29264498572 ("Crawler live test", job 86866101807), GEN 1.2 recon step, 2026-07-13. Quotes are VERBATIM from the recon output (the recon truncates table rows at 400 chars and TXT lines at 300 chars; a quote ending mid-word is a recon truncation, not an omission here). Use this file to seed `src/lib/customs-overrides.ts` - but per project policy, only after eyeballing the cited live page once per country.

Note on designations: in AD 1.3, `INTL` = the state designates the aerodrome for international traffic (customs/immigration available or arrangeable); `NTL` = national only. Several AIPs (FI, PT) additionally name explicit customs/border-crossing airports in GEN 1.2 - where both exist, GEN 1.2 is the stronger customs source and AD 1.3 the fallback.

## EE - Estonia - SUCCESS (GEN-1.2 en-GB + AD-1.3 en-GB)

Pages:
- `https://eaip.eans.ee/2026-07-09/html/eAIP/EE-GEN-1.2-en-GB.html`
- `https://eaip.eans.ee/2026-07-09/html/eAIP/EE-AD-1.3-en-GB.html`

GEN 1.2 has an explicit customs table (7 rows, header `Aerodrome | Customs OPR HR`):

```
Kärdla | H24 - 1 HR PN *
Kuressaare | H24 - 1 HR PN *
Pärnu | H24 - 1 HR PN *
Lennart Meri Tallinn | H24
Tartu | H24 - 1 HR PN *
```
(`* FPL is accepted` - i.e. the flight plan serves as the prior notice.)

AD 1.3 INTL rows (verbatim):

```
KURESSAARE EEKE 581348N 0223034E | INTL – NTL | IFR – VFR | S – NS – GA | AD 2 EEKE
KÄRDLA EEKA 585927N 0224951E | INTL – NTL | IFR – VFR | S – NS – GA | AD 2 EEKA
LENNART MERI TALLINN EETN 592448N 0244957E | INTL – NTL | IFR – VFR | S – NS – GA | AD 2 EETN
PÄRNU EEPU 582508N 0242822E | INTL – NTL | IFR – VFR | S – NS – GA | AD 2 EEPU
TARTU EETU 581827N 0264113E | INTL – NTL | IFR – VFR | S – NS – GA | AD 2 EETU
ÄMARI (MIL) EEEI 591544N 0241307E | INTL – NTL | IFR – VFR | MIL | AD 2 EEEI
```

Candidate customs entries (GEN 1.2 x AD 1.3 agree 1:1 for civil fields):
- EETN (Lennart Meri Tallinn): customs H24
- EEKA (Kärdla): customs H24, 1 HR prior notice (FPL accepted)
- EEKE (Kuressaare): customs H24, 1 HR PN (FPL accepted)
- EEPU (Pärnu): customs H24, 1 HR PN (FPL accepted)
- EETU (Tartu): customs H24, 1 HR PN (FPL accepted)
- EEEI (Ämari): INTL but MIL-only traffic - not a GA customs field

All other EE fields in AD 1.3 are `NTL` (no customs).

## FI - Finland - SUCCESS (GEN 1.2 / AD 1.3, space-spelled filenames, en-GB)

The hyphen spelling 404'd; the space spelling worked:
- `https://www.ais.fi/eaip/currently_effective/eAIP/EF-GEN%201.2-en-GB.html`
- `https://www.ais.fi/eaip/currently_effective/eAIP/EF-AD%201.3-en-GB.html`

GEN 1.2 names the statutory border crossing points (Decree 901/2006, Section 6) - verbatim (recon-truncated at 300 chars):

```
Such a border crossing point for air traffic are as follows: Enontekiö (EFET), Helsinki-Vantaa (EFHK), Ivalo (EFIV), Joensuu (EFJO), Jyväskylä (EFJY), Kajaani (EFKI), Kemi-Tornio (EFKE), Kittilä (EFKT), Kokkola-Pietarsaari (EFKK), Kuopio (EFKU), Kuusamo (EFKS), Lappeenranta (EFLP), Mariehamn (EFMA), Oulu (EFOU), Pori (EFPO), Rovaniemi (EFRO), Savonlinna (EFSA
```

(The AD 1.3 INTL-NTL list continues past the truncation with Seinäjoki (EFSI), Tampere-Pirkkala (EFTP), Turku (EFTU), Utti (EFUT), Vaasa (EFVA), Varkaus (EFVR) - see AD 1.3 below; the GEN 1.2 quote itself was cut by the recon.)

GEN 1.2 also carries a permission-required table for named non-international fields (verbatim rows):

```
AD laskupaikka AD landing site | Lupa tulliviranomaiselta tarvitaan Permission from customs authority needed | Rajanylityslupa tarvitaan Permission for border crossing needed | Lupa ulkomaiselta siviili-ilma-alukselta tarvitaan (MIL AD) Permission for foreign aircraft needed (MIL AD) | RMK
Halli (EFHA) | X (48 HR) | X (48 HR) | X (24 HR)
Mikkeli (EFMI) | X (24 HR) | X (24 HR) | -
Utti (EFUT) | X (48 HR) | X (48 HR) | X (24 HR)
```

Plus context lines (verbatim):

```
At international aerodromes, customs and border control services are available on a regular basis. For operational hours at each aerodrome, see part AD 2.
Halli (EFHA) and Utti (EFUT): 48 hours before the intended flight
Mikkeli (EFMI): 24 hours before the intended flight;
6.2. Aerodromes with facilities for administration of public health are Helsinki-Vantaa (EFHK) and Turku (EFTU). Both airports are designated quarantine aerodromes as described in AD 1.4.
```

AD 1.3 INTL-NTL rows (deduplicated set across the page's two tables, verbatim format `NAME ICAO | INTL-NTL | ...`):

```
ENONTEKIÖ EFET | INTL-NTL | IFR-VFR | S-NS-P | EFET AD 2
HALLI EFHA | INTL-NTL | IFR-VFR | NS-P | EFHA AD 2
HELSINKI-VANTAA EFHK | INTL-NTL | IFR-VFR | S-NS-P | EFHK AD 2
IVALO EFIV | INTL-NTL | IFR-VFR | S-NS-P | EFIV AD 2
JOENSUU EFJO | INTL-NTL | IFR-VFR | S-NS-P | EFJO AD 2
JYVÄSKYLÄ EFJY | INTL-NTL | IFR-VFR | S-NS-P | EFJY AD 2
KAJAANI EFKI | INTL-NTL | IFR-VFR | S-NS-P | EFKI AD 2
KEMI-TORNIO EFKE | INTL-NTL | IFR-VFR | S-NS-P | EFKE AD 2
KITTILÄ EFKT | INTL-NTL | IFR-VFR | S-NS-P | EFKT AD 2
KOKKOLA-PIETARSAARI EFKK | INTL-NTL | IFR-VFR | S-NS-P | EFKK AD 2
KUOPIO EFKU | INTL-NTL | IFR-VFR | S-NS-P | EFKU AD 2
KUUSAMO EFKS | INTL-NTL | IFR-VFR | S-NS-P | EFKS AD 2
LAPPEENRANTA EFLP | INTL-NTL | IFR-VFR | S-NS-P | EFLP AD 2
MARIEHAMN EFMA | INTL-NTL | IFR-VFR | S-NS-P | EFMA AD 2
MIKKELI EFMI | INTL-NTL | IFR-VFR | S-NS-P | EFMI AD 2
OULU EFOU | INTL-NTL | IFR-VFR | S-NS-P | EFOU AD 2
PORI EFPO | INTL-NTL | IFR-VFR | S-NS-P | EFPO AD 2
ROVANIEMI EFRO | INTL-NTL | IFR-VFR | S-NS-P | EFRO AD 2
SAVONLINNA EFSA | INTL-NTL | IFR-VFR | S-NS-P | EFSA AD 2
SEINÄJOKI EFSI | INTL-NTL | IFR-VFR | S-NS-P | EFSI AD 2
TAMPERE-PIRKKALA EFTP | INTL-NTL | IFR-VFR | S-NS-P | EFTP AD 2
TURKU EFTU | INTL-NTL | IFR-VFR | S-NS-P | EFTU AD 2
TURUN YLIOPISTOLLINEN KESKUSSAIRAALA EFTV | INTL INTL-NTL | VFR | P | EFTV AD 3
UTTI EFUT | INTL-NTL | IFR-VFR | NS-P | EFUT AD 2
VAASA EFVA | INTL-NTL | IFR-VFR | S-NS-P | EFVA AD 2
VARKAUS EFVR | INTL-NTL | IFR-VFR | P | EFVR AD 2
```

Candidate customs entries:
- Border crossing points (customs/border control on a regular basis): EFET, EFHK, EFIV, EFJO, EFJY, EFKI, EFKE, EFKT, EFKK, EFKU, EFKS, EFLP, EFMA, EFOU, EFPO, EFRO, EFSA, EFSI, EFTP, EFTU, EFVA (and per AD 1.3 also EFVR - verify EFVR against the GEN 1.2 sentence continuation before adding, the recon quote was truncated before its position).
- Permission-required (NOT free customs fields, note as restricted): EFHA (customs PPR 48 HR), EFMI (customs PPR 24 HR), EFUT (customs PPR 48 HR, MIL).
- EFTV is a hospital heliport (AD 3) with an odd `INTL INTL-NTL` designation - skip.

## LV - Latvia - SUCCESS (GEN-1.2 en-GB + AD-1.3 en-GB), customs designations only via AD 1.3

Pages:
- `https://ais.lgs.lv/eAIPfiles/2026_005_09-JUL-2026/data/2026-07-09/html/eAIP/EV-GEN-1.2-en-GB.html`
- `https://ais.lgs.lv/eAIPfiles/2026_005_09-JUL-2026/data/2026-07-09/html/eAIP/EV-AD-1.3-en-GB.html`

GEN 1.2 contains NO per-aerodrome customs table - only the generic documents table (verbatim):

```
Required by | General declaration | Passanger manifest | Cargo manifest
Customs | 1 | 1 | 1
Border-guard | 1 | NIL | NIL
```

AD 1.3 full aerodrome table (17 rows) - INTL rows verbatim:

```
LIELVARDE (MIL) EVGA | INTL-NTL | IFR-VFR | MIL | AD 2 EVGA
LIEPAJA EVLA | INTL-NTL | IFR-VFR | S-NS-GA | AD 2 EVLA
RIGA EVRA | INTL-NTL | IFR-VFR | S-NS-GA | AD 2 EVRA
VENTSPILS EVVA | INTL-NTL | VFR | GA | AD 2 EVVA
```

NTL rows (no customs): `ADAZI EVAD`, `CESIS EVCA`, `IKSHKILE EVPA`, `LIMBAZI EVLI`, `SPILVE EVRS`; heliports `LIELVARDE M SOLA EVSM`, `LUDZA ASOP EVLU`, `NAKOTNE HELIPORT EVHN`.

Candidate customs entries: EVRA (Riga), EVLA (Liepaja), EVVA (Ventspils, VFR only) - all `INTL-NTL`; EVGA is MIL. Customs operating hours are not in GEN 1.2 - verify per field in AD 2 before writing override text beyond "international / customs airport".

## IS - Iceland - SUCCESS (GEN 1.2 / AD 1.3, space-spelled filenames, en-GB)

The hyphen spelling 404'd; the space spelling worked:
- `https://eaip.isavia.is/A_06-2026_2026_06_11/eAIP/BI-GEN%201.2-en-GB.html`
- `https://eaip.isavia.is/A_06-2026_2026_06_11/eAIP/BI-AD%201.3-en-GB.html`

GEN 1.2 names the international (i.e. customs-capable entry) aerodromes explicitly (verbatim):

```
Civil aircraft flying to or/and departing Iceland shall make their first landing at, or/and final departure from international aerodrome. Designated international aerodromes are: Keflavik Airport, Reykjavik Airport, Egilsstadir Airport, and Akureyri Airport.
```

AD 1.3 INTL rows (verbatim):

```
AKUREYRI / AKUREYRI BIAR* | INTL-NTL | IFR - VFR | S-NS-P | AD 2 - BIAR
EGILSSTAÐIR / EGILSSTADIR BIEG* | INTL-NTL | IFR - VFR | S-NS-P | AD 2 - BIEG
KEFLAVÍK / KEFLAVIK BIKF | INTL-NTL | IFR - VFR | S-NS-P | AD 2 - BIKF
REYKJAVÍK / REYKJAVIK BIRK | INTL-NTL | IFR - VFR | S-NS-P | AD 2 - BIRK
```

All other ~50 aerodromes in AD 1.3 are `NTL` (heliports: `NIL`). Candidate customs entries: BIKF, BIRK, BIEG, BIAR - GEN 1.2 and AD 1.3 agree exactly. This is the cleanest four-entry override set of the batch.

## PT - Portugal - SUCCESS (GEN-1.2 en-PT + AD-1.3 en-PT)

Pages:
- `https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/html/eAIP/LP-GEN-1.2-en-PT.html`
- `https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/html/eAIP/LP-AD-1.3-en-PT.html`

GEN 1.2 key lines (verbatim, recon-truncated at 300 chars):

```
not later than five (5) days before intended date of operation, application for non-scheduled air services at class IV aerodromes (international airports – LPPT, LPPR, LPFR, LPMA, LPPS, LPPD, LPHR and LPAZ), by using the applicable form, available at ANAC website, and
```

```
Intra-EU (EU, EEA and Switzerland) flights, excluding non-Schengen flights (to/from Ireland and Cyprus), inbound or outbound of aerodromes and ultralight runways, are not subject to authorisation. Commercial air transport operations are not allowed at the following aerodromes: LPBR (Braga), LPIN (Es
```

```
Intra-EU non-Schengen flights (to/from Ireland and Cyprus), inbound or outbound of LPCS (Cascais), LPFL (Flores), LPPI (Pico), LPGR (Graciosa), LPSJ (S. Jorge), LPCR (Corvo), LPBG (Bragança), LPVR (Vila Real), LPCH (Chaves), LPCO (Coimbra), LPEV (Évora), LPVZ (Viseu), LPSO (Ponte De Sor), LPPM (Port
```

```
Extra-EU (other than EU, EEA and Switzerland) flights inbound or outbound of LPCS (Cascais), LPFL (Flores), LPPI (Pico), LPGR (Graciosa) and LPSJ (S. Jorge) are subject to authorisation from the Portuguese Civil Aviation Authority (ANAC), the Polícia de Segurança Pública (PSP), Customs Authority (AT
```

AD 1.3 INTL rows (verbatim):

```
Beja (Air Base NR 11) / LPBJ | NTL / INTL / IFR / VFR / S / NS / MIL | AD 2 LPBJ
Faro / LPFR | INTL / IFR / VFR / S / NS | AD 2 LPFR
Lajes (Air Base NR 4) / LPLA | INTL / IFR / VFR / S / NS / MIL | AD 2 LPLA
Lisboa / LPPT | INTL / IFR / VFR / S / NS | AD 2 LPPT
Madeira / LPMA | INTL / IFR / VFR / S / NS | AD 2 LPMA
Ponta Delgada / LPPD | INTL / IFR / VFR / S / NS | AD 2 LPPD
Porto / LPPR | INTL / IFR / VFR / S / NS | AD 2 LPPR
Porto Santo / LPPS | INTL / IFR / VFR / S / NS | AD 2 LPPS
Santa Maria / LPAZ | INTL / IFR / VFR / S / NS | AD 2 LPAZ
```

Candidate customs entries:
- International airports (GEN 1.2 class IV): LPPT, LPPR, LPFR, LPMA, LPPS, LPPD, LPHR, LPAZ. CONFLICT to resolve before shipping LPHR: GEN 1.2 lists Horta (LPHR) as an international airport, but its AD 1.3 row is `Horta / LPHR | NTL / IFR / VFR / S / NS | AD 2 LPHR` (no INTL). Check AD 2 LPHR on the live page.
- Also INTL per AD 1.3: LPBJ (Beja, NTL/INTL, mixed MIL) and LPLA (Lajes, MIL air base with INTL civil traffic).
- Extra-EU flights need prior authorisation (customs on request, NOT free entry points): LPCS, LPFL, LPPI, LPGR, LPSJ.
- Intra-EU non-Schengen (Ireland/Cyprus) allowed with notification at: LPCS, LPFL, LPPI, LPGR, LPSJ, LPCR, LPBG, LPVR, LPCH, LPCO, LPEV, LPVZ, LPSO, LPPM (list recon-truncated after "LPPM (Port"; re-check the live page for the tail of the list).

## HU - Hungary - PARTIAL (GEN 1.2 fetched but empty; AD 1.3 en-HU is the source)

Pages:
- `https://ais-en.hungarocontrol.hu/aip/2026-06-11/2026-06-11-AIRAC/html/eAIP/LH-GEN-1.2-en-HU.html` - fetched OK (title `AIP for HUNGARY (section GEN-1.2) valid from 11 JUN 2026`) but the recon found NO customs tables and NO ICAO-bearing lines (`[debug] no hits`).
- `https://ais-en.hungarocontrol.hu/aip/2026-06-11/2026-06-11-AIRAC/html/eAIP/LH-AD-1.3-en-HU.html` - full table.

AD 1.3 rows - ALL eight listed aerodromes are INTL - NTL (verbatim):

```
BÉKÉSCSABA LHBC | INTL - NTL | IFR - VFR | GA | AD 2-LHBC
BUDAPEST/Liszt Ferenc International Airport LHBP | INTL - NTL | IFR - VFR | S - NS -GA | AD 2-LHBP
DEBRECEN LHDC | INTL - NTL | IFR - VFR | S - NS -GA | AD 2-LHDC
GYŐR/Pér LHPR | INTL - NTL | IFR - VFR | GA | AD 2-LHPR
NYÍREGYHÁZA LHNY | INTL - NTL | IFR - VFR | NS-GA | AD 2-LHNY
PÉCS/Pogány LHPP | INTL - NTL | IFR - VFR | GA | AD 2-LHPP
HÉVÍZ/Balaton LHSM | INTL - NTL | IFR - VFR | S - NS -GA | AD 2-LHSM
SZEGED LHUD | INTL - NTL | IFR - VFR | GA | AD 2-LHUD
```

Candidate customs entries: LHBC, LHBP, LHDC, LHPR, LHNY, LHPP, LHSM, LHUD - all INTL - NTL (Hungary is Schengen; customs relevance is for extra-EU. Whether customs is H24 or on-request differs per field - check AD 2 before writing operating-hours text). Note the HU AIP only lists AD-2 fields here; small VFR strips are outside this eAIP.

## ES - Spain - FAILED (needs a country-specific recon)

The generic eurocontrol recon requires a `/eAIP/`-style URL to derive the GEN 1.2 sibling path; the ES crawler's URLs are ENAIRE-specific (verbatim):

```
sample url: https://aip.enaire.es/AIP/contenido_AIP/AD/AD2/LECO/LE_AD_2_LECO_en.html
sample url: https://aip.enaire.es/AIP/contenido_AIP/AD/AD2/LEAB/LE_AD_2_LEAB_en.html
sample url: https://aip.enaire.es/AIP/contenido_AIP/AD/AD2/LEAL/LE_AD_2_LEAL_en.html
no /eAIP/ style URL - needs a country-specific recon
```

No GEN 1.2 / AD 1.3 data captured for ES in this run. A bespoke recon against ENAIRE's GEN section layout is required before ES customs overrides can be written.
