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
| PT | https://ais.nav.pt/ | `eAIP_Current/eAIP_Online/eAIP/html/index.html` + separates **eVFR** (`eVFR_Current/eVFR_Online/eAIP/html/eAIP/LP-menu-pt-PT.html`, PT-only menu) - **eVFR jetzt gemerged** (`pt.py` `_crawl_evfr`, 14.07.2026): PT 19 -> 83 (39 vfr + 44 AD-3 heliports), 100% Chart-PDF, Heliport-Seite aktiviert |
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
| FI | 40 | 29257457290 (Titel bereinigt); keine PDF-Muster - die AD-2-Seite anchor-verlinkt nur WPT_LIST/FAS_DB-Daten-PDFs (auch EFHK, Run 29278021225); Chart-Verzeichnis-Konvention `Root_WePub/ANSFI/Charts/AD/<ICAO>/` identifiziert, nächster Hop: AD-2.24-Markup dumpen |
| ES | 51 | 29258501240 (Owner-Auftrag trotz Nicht-eurocontrol); PDF + gen12 brauchen bespoke Recon |
| LV | 12 | 29259295508; PDF 12/12 via AD-2.24-Position (29265643933) |
| IS | 53 | 29265643933 (AD-/LS-Kapitel, Dedupe by ICAO - 106 waren systematische Doppel) |
| PT | 19 | 29265643933; PDF 19/19 (`_01-1_en.pdf` = ADC) |
| HU | 73 | 8 eAIP + **65 VFR-Manual** (`hu.py` `_crawl_vfr_manual`, bespoke Tabelle `ais-en.hungarocontrol.hu/vfrmanual`, PDFs auf storage.hungarocontrol.hu; 14.07.2026); PDF 73/73 |
| SI | 4 | 29272420058 (TLS via gepinntem Intermediate, use_extra_ca); Customs LJLJ/LJMB/LJPZ + PDF-Muster wie PT (29273393673); GELAUNCHT 13.07.2026 |
| DK | 35 | Naviair-Umbraco-JSON-API statt Playwright-DOM (Netzwerk-Capture-Fund, Runs 29289869395/29291960740/29291001169); 32 vfr + Heliports EKRB/EKRH aus AD 3, 100% pdf_url, 134 Charts; kein generischer gen12 (Naviair ist kein eurocontrol-eAIP - bespoke Recon offen); GELAUNCHT 14.07.2026 |

Der CZ-Stil "ein Kapitel pro Aerodrom" ist jetzt generisch:
`HttpEurocontrolBase.extract_airports_per_chapter()` (ICAO aus der
Section-id-Regex, Titel-Präfix überschreibbar - IS nutzt `AD BIAR ...`
statt `AD 2.XXXX`).

**GELAUNCHT 13.07.2026** (PR #228/#229/#230): alle 7 Länder sind in
`liveCountries`, der Erst-Publish lief (Run 29268659725, 191 Airports)
und die Live-Verifikation nach dem CD-Deploy war grün - alle 19
geprüften URLs (Landing, Listen, Sitemaps, ?ICAO-Detail) liefern 200
(Run 29270333630). Customs-Overrides EE/FI/LV/IS/PT/HU (45 Einträge,
Quelle `crawlers/recon/gen12-batch1.md`), Chart-PDF-Muster EE/LV/PT/HU.
Noch offen: FI/IS/ES-Chart-PDF (tiefere Navigation nötig), ES-Customs
(bespoke Recon), gen12-Läufe der neuen Länder ins EFB-/Customs-Doku
übernehmen.

## Batch 2 - Zugang/URL klären (je eine Folge-Probe)

| Land | Stand | Nächster Schritt |
| --- | --- | --- |
| IE | GEPARKT: auch der Web-Unlocker scheitert ("502 Navigation failed"); jeder Handshake endet mit SSL-Alert 40 vor der Cipher-Wahl (openssl default/legacy/SECLEVEL=1, Chromium, Unlocker - Run 29278021225, `crawlers/recon/round4-unlocker-fi.md`) - vermutlich Client-Zertifikat / IP-Allowlist / Geo-Gate | Owner-Recherche: funktioniert iaip.iaa.ie im Browser? Anderen IAA-Host suchen |
| HR | crocontrol.hr-Root ohne AIP-Links (JS-Menü) | direkte eAIP-URL recherchieren (Owner/Browser) |
| SK | GEPARKT: WAF lehnt auch die Unlocker-Exit-IPs ab ("502 response status was rejected", Run 29278021225) - Sperre weder IP- noch TLS-basiert | tiefere eAIP-URL statt der Root proben; andere lps.sk-Subdomain suchen |
| LT | ZUGANG GELÖST: Web-Unlocker holt HTML (200, "AB Oro navigacija", Run 29278021225) - aber die Root verlinkt keinen eAIP-Einstieg | direkte eAIP-Kandidaten-URLs via Unlocker proben (z.B. `/en/aip`, ais-Subdomains) |

## Außerhalb des Auftrags (keine eurocontrol-Struktur / gated)

- **ES** (ENAIRE): frei zugänglich, aber eigene statische Struktur
  (`contenido_AIP/GEN/LE_GEN_0_1_es.html`, AD-Seiten direkt verlinkt) -
  machbar mit eigenem `HttpCrawlerBase`-Crawler, aber nicht eurocontrol.
  Kandidat für eine spätere Sonderrunde (wie DE/AT).
- **RO** (aisro.ro): altes Frameset, Inhalte vermutlich hinter
  Registrierung.
- **CH** (skybriefing): eAIP hinter Login-Portal.
- **BG** (b-flip.bulatsa.com): der Playwright-Render (Run 29270333630,
  `crawlers/recon/probe-ie-bg.md`) zeigt eine LOGIN-WALL ("Sign in to
  BULATSA Flight Information Portal") - kein öffentlicher eAIP-Pfad,
  bis ein session-freier Einstieg gefunden ist.

## Reihenfolge

1. Batch 1 implementieren (ein PR pro 1-2 Länder; EE+FI zuerst - die
   Strukturen liegen am nächsten an CZ/NL).
2. Batch-2-Proben nebenbei (je ein probe_eaip-Lauf), Nachzügler in
   Batch 1 aufnehmen sobald zugänglich.
3. ES ggf. als Sonderfall danach (Owner-Entscheidung).
