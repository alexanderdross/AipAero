# GEN 1.2 / AD 1.3 customs recon - SI (Slovenia)

Source: GitHub Actions run 29273393673 ("Crawler live test", job 86896428531), GEN 1.2 recon step, 2026-07-13 (inputs: countries=SI, pdf_recon=true, gen12=SI). Quotes are VERBATIM from the recon output. Conventions as in `gen12-batch1.md`: in AD 1.3, `INTL` = designated for international traffic (customs available/arrangeable), `NTL` = national only; entries seed `src/lib/customs-overrides.ts` only after eyeballing the cited live page.

Note: the first attempt (run 29272675868) failed all recon fetches with `CERTIFICATE_VERIFY_FAILED` - this is the rerun after the recon clients learned to trust the pinned RapidSSL intermediate (`RapidSSLTLSRSACAG1.crt.pem`, same fix the SI crawler uses via `use_extra_ca`).

## SI - Slovenia - SUCCESS (GEN-1.2 en-GB + AD-1.3 en-GB)

Pages fetched (both hyphen-spelled, en-GB):

- `https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-GEN-1.2-en-GB.html`
- `https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-1.3-en-GB.html`

### GEN 1.2 (verbatim)

The GEN 1.2 page has no per-aerodrome customs table - its header tables are authority addresses, and the TXT lines defer to the AD 2 chapters of exactly three fields:

```
   --- GEN-1.2 page: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-GEN-1.2-en-GB.html
   hdr table 1 (9 rows): Post: | Ministrstvo za infrastrukturo | Ministry of Infrastructure
   hdr table 2 (11 rows): Post: | Ministrstvo za infrastrukturo | Ministry of Infrastructure
   hdr table 3 (12 rows): Post: | Ministrstvo za infrastrukturo | Ministry of Infrastructure
   hdr table 4 (7 rows): Post: | Ministrstvo za zunanje zadeve Konzularni sektor Prešernova 25 SI-1000 Ljubljana SLOVENIJA | Ministry of Foreign Affairs Consular Department Presernova 25 SI-1000 Ljubljana SLOVENIA
   TXT LJLJ AD 2
   TXT LJMB AD 2
   TXT LJPZ AD 2
```

The three ICAOs named in GEN 1.2 (LJLJ, LJMB, LJPZ) are exactly the three INTL fields of AD 1.3 below - consistent.

### AD 1.3 (verbatim, full 24-row table)

```
   --- AD-1.3 page: https://aim.sloveniacontrol.si/aim/eAIP/Operations/2026-07-09-AIRAC/html/eAIP/LJ-AD-1.3-en-GB.html
   hdr table 1 (24 rows): Aerodrome/heliport name Location indicator | Type of traffic permitted to use the aerodrome/heliport | Reference to AD Section and remarks
     Aerodrome/heliport name Location indicator | Type of traffic permitted to use the aerodrome/heliport | Reference to AD Section and remarks
     International-National (INTL-NTL) | IFR-VFR | S = Scheduled NS = Non-scheduled P = Private
     1 | 2 | 3 | 4 | 5
     AJDOVSCINA LJAJ | NTL | VFR | P | AD 4 LJAJ
     BOVEC LJBO | NTL | VFR | P | AD 4 LJBO
     CELJE LJCL | NTL | VFR | P | AD 4 LJCL
     CERKLJE OB KRKI LJCE | NTL | IFR-VFR | - | AD 2 LJCE
     DIVACA LJDI | NTL | VFR | P | AD 4 LJDI
     HELIPORT SB CELJE LJHC | NTL | VFR | P | AD 1.4.2.5
     HELIPORT SB IZOLA LJHI | NTL | VFR | P | AD 1.4.2.4
     HELIPORT JESENICE LJHJ | NTL | VFR | P | AD 1.4.2.2
     HELIPORT SB SLOVENJ GRADEC LJHS | NTL | VFR | P | AD 1.4.2.3
     HELIPORT UKC LJUBLJANA LJHL | NTL | VFR | P | AD 1.4.2.1
     LESCE/BLED LJBL | NTL | VFR | P | AD 4 LJBL
     LJUBLJANA/BRNIK LJLJ | INTL-NTL | IFR-VFR | S-NS-P | AD 2 LJLJ
     MARIBOR/OREHOVA VAS LJMB | INTL-NTL | IFR-VFR | S-NS-P | AD 2 LJMB
     MURSKA SOBOTA LJMS | NTL | VFR | P | AD 4 LJMS
     NOVO MESTO LJNM | NTL | VFR | P | AD 4 LJNM
     PORTOROZ/SECOVLJE LJPZ | INTL-NTL | IFR-VFR | S-NS-P | AD 2 LJPZ
     POSTOJNA LJPO | NTL | VFR | P | AD 4 LJPO
     PTUJ LJPT | NTL | VFR | P | AD 4 LJPT
     SLOVENJ GRADEC LJSG | NTL | VFR | P | AD 4 LJSG
     SLOVENSKE KONJICE LJSK | NTL | VFR | P | AD 4 LJSK
     SOSTANJ LJSO | NTL | VFR | P | AD 4 LJSO
```

(The page's TXT lines repeat the same ICAOs/AD references: `TXT LJLJ` / `TXT AD 2 LJLJ`, `TXT LJMB` / `TXT AD 2 LJMB`, `TXT LJPZ` / `TXT AD 2 LJPZ`, `TXT LJCE` / `TXT AD 2 LJCE`, plus the AD 4 fields and the five heliports - no additional ICAOs beyond the table.)

### Candidate ICAO -> designation pairs

INTL (customs available/arrangeable - candidates for `customs-overrides.ts` after eyeballing the live AD 1.3 page):

- LJLJ (LJUBLJANA/BRNIK): `INTL-NTL | IFR-VFR | S-NS-P` - also named in GEN 1.2 (`TXT LJLJ AD 2`)
- LJMB (MARIBOR/OREHOVA VAS): `INTL-NTL | IFR-VFR | S-NS-P` - also named in GEN 1.2 (`TXT LJMB AD 2`)
- LJPZ (PORTOROZ/SECOVLJE): `INTL-NTL | IFR-VFR | S-NS-P` - also named in GEN 1.2 (`TXT LJPZ AD 2`)

NTL (no customs designation):

- LJCE (CERKLJE OB KRKI): `NTL | IFR-VFR | -` - the only other AD-2 field the crawler returns (military-operated); INTL is NOT indicated
- All AD 4 fields (LJAJ, LJBO, LJCL, LJDI, LJBL, LJMS, LJNM, LJPO, LJPT, LJSG, LJSK, LJSO) and the five hospital heliports (LJHC, LJHI, LJHJ, LJHS, LJHL) are `NTL`

Coverage of the crawler's 4 AD-2 fields (LJLJ, LJMB, LJPZ, LJCE) is complete: 3x INTL-NTL, 1x NTL.
