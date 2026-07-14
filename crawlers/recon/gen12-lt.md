# LT customs recon - AD 1.3 (via Web Unlocker)

Source: ANS Lithuania eAIP, AIRAC 2026-06-11, fetched on the self-hosted
runner through the Bright Data Web Unlocker (ans.lt WAFs datacenter IPs).
`crawler-live-test.yml` `gen12: LT`, run 29351725602 (14.07.2026).

- GEN 1.2 page: `https://www.ans.lt/a1/aip/03_11Jun2026/2026-06-11-000000/html/eAIP/EY-GEN-1.2-en-US.html`
  - Carries only the responsible-authorities tables and a "Required by /
    General declaration / Passenger manifest / Cargo manifest" forms table -
    NO per-aerodrome customs table. So AD 1.3 is the customs source (same as
    LV/HU/NO).
- AD 1.3 page: `https://www.ans.lt/a1/aip/03_11Jun2026/2026-06-11-000000/html/eAIP/EY-AD-1.3-en-US.html`

## AD 1.3 "Index to aerodromes" - verbatim rows

Columns: Location indicator | International/National/Military (INTL - NTL - MIL)
| IFR - VFR | S=Scheduled NS=Non-scheduled P=Private | Remarks

```
KAUNAS EYKA   | INTL - NTL       | IFR - VFR | S - NS - P | AD 2 EYKA
PALANGA EYPA  | INTL - NTL       | IFR - VFR | S - NS - P | AD 2 EYPA
ŠIAULIAI EYSA | INTL - NTL - MIL | IFR - VFR | NS         | AD 2 EYSA
VILNIUS EYVI  | INTL - NTL       | IFR - VFR | S - NS - P | AD 2 EYVI
HELIPORTS: NIL
```

## Decision -> customs-overrides.ts

All four aerodromes are INTL -> customs available. EYSA is INTL-NTL-MIL
(joint civil/military, non-scheduled civil) - included, unlike MIL-only
fields (EE EEEI, DK EKSP). No heliports. No NTL-only fields to exclude.

    EYKA, EYPA, EYSA, EYVI = true
