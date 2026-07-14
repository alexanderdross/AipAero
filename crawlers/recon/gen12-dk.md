# DK customs recon - Naviair AIP Danmark GEN 1.2 + AD 1.3

Source: GitHub Actions run **29316322474** ("Crawler live test", self-hosted
runner, 2026-07-14), `naviair_gen12` recon step. Denmark's AIP is the Naviair
Umbraco JSON tree (`aim.naviair.dk`), NOT a eurocontrol eAIP, so the generic
`gen12` recon (which parses an HTML AD 1.3 table) does not apply - this run
walked the JSON tree to the GEN 1.2 / AD 1.3 PDF documents and extracted their
text with `pypdf`.

## Tree location (verbatim)

```
===== GEN subtree (id 655) =====
- 673 GEN 1 NATIONAL REGULATIONS AND REQUIREMENTS  href=None
   - 678 EK_GEN_1_2_en.pdf  href=/media/files/4iin5cdcxtv/EK_GEN_1_2_en.pdf
   ...
===== AD subtree (id 296) =====
- 299 AD 1 AERODROMES-HELIPORTS - INTRODUCTION  href=None
   - 301 EK_AD_1_3_en.pdf  href=/media/files/b4zusaaqmku/EK_AD_1_3_en.pdf
```

## Where the customs list lives

`EK_GEN_1_2` ("Entry, Transit and Departure of Aircraft", AIRAC AMDT 05/22) is
prose procedure - it delegates the aerodrome list to AD 1.3:

> "Aircraft flying into or departing from Danish territory shall make their
> first landing at, or final departure from, an international aerodrome/heliport
> (see AD 1.3)."

`EK_AD_1_3` "Index to Aerodromes" (AIRAC AMDT 07/24, dated **11 JUL 24**) carries
the INTL/NTL column. Footnote **`1) To/from Schengen States only.`** There is no
separate "toldkontrol" table - INTL is the customs/international-entry marker.

## Designations (verbatim names + codes)

| Aerodrome | ICAO | INTL/NTL | in overrides |
| --- | --- | --- | --- |
| Aalborg (CIV/MIL) | EKYT | INTL/NTL | true |
| Aarhus | EKAH | INTL/NTL | true |
| Anholt | EKAT | INTL 1) /NTL | absent (Schengen only) |
| Billund | EKBI | INTL/NTL | true |
| Bornholm/Roenne | EKRN | INTL/NTL | true |
| Esbjerg | EKEB | INTL/NTL | true |
| Herning | EKHG | INTL/NTL | true |
| Kalundborg | EKKL | NTL | absent (national only) |
| Karup (MIL/CIV) | EKKA | INTL/NTL | true |
| Kolding/Vamdrup | EKVD | INTL/NTL | true |
| Krusaa-Padborg | EKPB | NTL | absent (national only) |
| Koebenhavn/Kastrup | EKCH | INTL/NTL | true |
| Koebenhavn/Roskilde | EKRK | INTL/NTL | true |
| Lemvig | EKLV | INTL/NTL | true |
| Lolland Falster/Maribo | EKMB | INTL/NTL | true |
| Laeso | EKLS | INTL 1) /NTL | absent (Schengen only) |
| Morso | EKNM | NTL | absent (national only) |
| Odense | EKOD | INTL/NTL | true |
| Randers | EKRD | INTL 1) /NTL | absent (Schengen only) |
| Ringsted | EKRS | INTL 1) /NTL | absent (Schengen only) |
| Samso | EKSS | NTL | absent (national only) |
| Sindal | EKSN | INTL/NTL | true |
| Skive | EKSV | INTL/NTL | true |
| Stauning | EKVJ | INTL/NTL | true |
| Soenderborg | EKSB | INTL/NTL | true |
| Thisted | EKTS | INTL/NTL | true |
| Toender | EKTD | INTL 1) /NTL | absent (Schengen only) |
| Taasinge/Elvira Madigan | EKST | INTL/NTL | true |
| Vesthimmerland | EKVH | INTL/NTL | true |
| Viborg | EKVB | INTL 1) /NTL | absent (Schengen only) |
| Vojens/Skrydstrup (MIL) | EKSP | INTL/NTL | absent (MIL, no GA entry) |
| AEroe | EKAE | INTL/NTL | true |

**Decision:** only the full-INTL fields become `customs: true` (21 fields). The
six INTL fields footnoted "to/from Schengen States only" cannot clear
third-country customs (same treatment as the NL Schengen-only fields), the four
National-only fields, and the MIL-only EKSP (same policy as EE EEEI Aemari) are
deliberately absent (no override -> merged OpenAIP/D1 value applies).
