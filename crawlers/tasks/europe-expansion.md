# Europa-Expansion: alle eurocontrol-eAIP-Länder

Ziel (Owner-Auftrag 13.07.2026): jedes europäische Land mit frei
zugänglicher eAIP in eurocontrol-Struktur auf AIP:Aero bringen - Crawler,
Locales, Routing, Sitemap, Customs (GEN 1.2 / AD 1.3).

Quellen-Klassifizierung per `probe_eaip`-Recon (Run 29256408808,
13.07.2026, self-hosted Runner; Status + Struktur-Marker verifiziert):

## Batch 1 - verifiziert frei zugänglich, eurocontrol-Struktur

| Land | Einstieg | Befund |
| --- | --- | --- |
| EE | https://eaip.eans.ee/ | Redirect auf `/<AIRAC>/html/` mit `index-en-GB.html` + `index-et.html` - klassisches eurocontrol eAIP |
| FI | https://www.ais.fi/eaip/ | **Stabiler Pfad `/eaip/currently_effective/eAIP/`**, Dateien mit Leerzeichen (`EF-GEN 2.2-fi-FI.html`) wie LVNL |
| IS | https://eaip.isavia.is/ | AIRAC-Editionsordner `A_06-2026_2026_06_11/` (LFV/PANSA-Ordnermuster) |
| PT | https://ais.nav.pt/ | `eAIP_Current/eAIP_Online/eAIP/html/index.html` + separates **eVFR** (`eVFR_Current/...`) |
| HU | https://ais-en.hungarocontrol.hu/aip/ | AIRAC-Editionsordner `/aip/<YYYY-MM-DD>/` (+ eaip.zip); Edition per Datum wählen wie UK |

Pro Land: `HttpEurocontrolBase`-Crawler (~40 Zeilen, Muster CZ/NL/UK),
zwei Locale-Dateien (nativ + `-EN`; Sprachen et/fi/is/pt/hu),
`routing.ts`-Eintrag (Prefix, `/airport-list`-Slug), `countryMeta` +
`countryTypeAvailability`, E2E-Matrix, `gen12`-Customs-Lauf (generisch),
Chart-PDF-Prioritäten per `pdf_recon`. Launch erst nach Live-Test
(`liveCountries` bleibt bis dahin unkommentiert).

## Status Crawler (live-validiert 13.07.2026) - Batch 1 KOMPLETT

| Land | Airports | Läufe |
| --- | --- | --- |
| EE | 8 | 29257033060; PDF-Muster VAC/ADC/LDG (29265643933) |
| FI | 40 | 29257457290 (Titel bereinigt); keine PDF-Muster - AD-2-Seite verlinkt keine Charts |
| ES | 51 | 29258501240 (Owner-Auftrag trotz Nicht-eurocontrol); PDF + gen12 brauchen bespoke Recon |
| LV | 12 | 29259295508; PDF 12/12 via AD-2.24-Position (29265643933) |
| IS | 53 | 29265643933 (AD-/LS-Kapitel, Dedupe by ICAO - 106 waren systematische Doppel) |
| PT | 19 | 29265643933; PDF 19/19 (`_01-1_en.pdf` = ADC) |
| HU | 8 | 29265643933; PDF 8/8 (VAC bevorzugt) |

Der CZ-Stil "ein Kapitel pro Aerodrom" ist jetzt generisch:
`HttpEurocontrolBase.extract_airports_per_chapter()` (ICAO aus der
Section-id-Regex, Titel-Präfix überschreibbar - IS nutzt `AD BIAR ...`
statt `AD 2.XXXX`).

Erledigt (13.07.2026): Website-Integration EE + FI (PR #228),
Customs-Overrides EE/FI/LV/IS/PT/HU (45 Einträge, Quelle
`crawlers/recon/gen12-batch1.md`), Chart-PDF-Muster EE/LV/PT/HU.
Noch offen: Website-Integration ES/LV/IS/PT/HU (Locales, Routing,
Meta, E2E), FI/IS/ES-Chart-PDF (tiefere Navigation nötig), ES-Customs
(bespoke Recon), Launch via `liveCountries` je Land nach komplettem
Paket.

## Batch 2 - Zugang/URL klären (je eine Folge-Probe)

| Land | Stand | Nächster Schritt |
| --- | --- | --- |
| BG | b-flip.bulatsa.com ist eine JS-App (0 Links im HTML) | Playwright-Crawler wie DK |
| IE | iaip.iaa.ie: TLS-Handshake-Failure (Legacy-Stack) | eigener SSL-Kontext (niedrigeres Security-Level) im Crawler |
| HR | crocontrol.hr-Root ohne AIP-Links (JS-Menü) | direkte eAIP-URL recherchieren (Owner/Browser) |
| SI | aim.sloveniacontrol.si: TLS-Kette ohne Intermediate (Probe 29264498572, `crawlers/recon/probe-si.md`) | eigener SSL-Kontext (wie IE), dann Re-Probe |
| SK | aim.lps.sk 403 trotz Browser-Headern | evtl. GEO/IP-Sperre; ggf. Bright-Data-Proxy wie GR |
| LT | ans.lt 403 trotz Browser-Headern | wie SK |

## Außerhalb des Auftrags (keine eurocontrol-Struktur / gated)

- **ES** (ENAIRE): frei zugänglich, aber eigene statische Struktur
  (`contenido_AIP/GEN/LE_GEN_0_1_es.html`, AD-Seiten direkt verlinkt) -
  machbar mit eigenem `HttpCrawlerBase`-Crawler, aber nicht eurocontrol.
  Kandidat für eine spätere Sonderrunde (wie DE/AT).
- **RO** (aisro.ro): altes Frameset, Inhalte vermutlich hinter
  Registrierung.
- **CH** (skybriefing): eAIP hinter Login-Portal.

## Reihenfolge

1. Batch 1 implementieren (ein PR pro 1-2 Länder; EE+FI zuerst - die
   Strukturen liegen am nächsten an CZ/NL).
2. Batch-2-Proben nebenbei (je ein probe_eaip-Lauf), Nachzügler in
   Batch 1 aufnehmen sobald zugänglich.
3. ES ggf. als Sonderfall danach (Owner-Entscheidung).
