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

## Batch 2 - Zugang/URL klären (je eine Folge-Probe)

| Land | Stand | Nächster Schritt |
| --- | --- | --- |
| BG | Portal https://b-flip.bulatsa.com/publications/aip/home gefunden | probe_eaip auf b-flip (JS-App? ggf. Playwright wie DK) |
| LV | ais.lgs.lv leitet auf `/user/login`; Link `\/aiseaip` existiert | probe_eaip auf https://ais.lgs.lv/aiseaip |
| IE | iaip.iaa.ie antwortet 409 (Session/WAF?) | probe mit Cookie-Flow; IAA-iAIP ist eurocontrol-basiert |
| HR | crocontrol.hr-Pfad 404 | richtige eAIP-URL recherchieren (Owner/Browser) |
| SI | sloveniacontrol.si-Pfad 404 | richtige eAIP-URL recherchieren (Owner/Browser) |
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
