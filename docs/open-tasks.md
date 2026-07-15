# AIP:Aero - Offene Aufgaben (Stand: 15.07.2026)

Status-Legende: 🔴 blockiert Folgearbeiten / heute erledigen · 🟡 als Nächstes · 🟢 danach / optional · ✅ erledigt

## Aktuelle Priorität (Owner 15.07.2026): 4 (AIRAC-Anzeige) → 3 (LT-VFR-Manual) → 2 (GR)

## ✅ Heute erledigt (15.07.2026, gemergt)

- **Flughafenlisten "Karte da, aber keine Liste" - GEFIXT (PR #271).** `cachedRead`
  cachte zur Laufzeit ein leeres `[]`, wenn das D1-Binding fehlte (Hintergrund-
  ISR-Regeneration ohne Cloudflare-Kontext) - das vergiftete die Liste sitewide
  (Karte lief weiter, weil client-gefetcht). Fix: beim Build weiter leeres
  Fallback, zur Laufzeit **werfen** statt leer zu cachen (stale-while-revalidate
  hält die letzte volle Liste). Produktion sofort per CD-Rerun wiederhergestellt.
- **SI AD-4** crawlen (PR #271): SI **4 → 16** Flugplätze (greift beim nächsten
  Crawl); eurocontrol-Base-Titel für AD 4 gesäubert. **DK AD-4**: Sackgasse
  (Dänemark publiziert Privatplätze nur als Listen-PDF, Live-Walk = 0) - dokumentiert.
- **Chart-Liste nach Flugphase gruppiert (PR #272):** Flugplatz → Sicht (VFR) →
  Anflug → Ankunft → Abflug → Sonstige, mit Gruppen-Überschriften, VFR-first
  (Owner-Wunsch). `charts.ts` `chartCategory`/`groupChartsByCategory`, i18n in
  allen 42 Locales.
- **Breadcrumb-`MISSING_MESSAGE` gefixt (PR #273):** CZ `/vfr` + PT `/heliports`
  fehlten in `BreadCrumbs` (Seiten nach Onboarding dazugekommen, i18n nie
  nachgezogen) - warfen Laufzeitfehler. Einträge ergänzt + **neuer CI-Guard**
  in `check-i18n.mjs` (jede Locale muss Breadcrumbs für jede tatsächlich
  gerenderte Seite haben, aus `countryTypeAvailability`).
- **IndexNow live verifiziert:** Key-Datei 200 (exakter Key), Submit an
  `api.indexnow.org` → HTTP 200 (akzeptiert). Der Bing-WMT-"Get Started"-Screen
  ist kein Fehler - das Dashboard hinkt hinterher / braucht Property-Verifikation.
- **AIRAC-Zyklus angezeigt (PR #274/#275):** Flughafenliste + Detailseiten zeigen
  jetzt das AIRAC-/Editionsdatum. DE (datumslose BasicVFR-Permalinks) erfasst der
  Crawler die Edition aus der physischen URL und reicht sie per `?airac=` durch.
- **LT-VFR-Manual gecrawlt (issue #35):** das offene "AIP VFR LITHUANIA"
  (`ans.lt/a1/aip_vfr/aip_vfr_<edition>/`, flacher PDF-Baum) gemergt - **LT 4 → 29**
  (4 eAIP-International + 25 kleine VFR-Felder, name-only, je 1 Chart-PDF). Live
  validiert (Run 29408944800, pdf_url 29/29). Damit ist die Drei-Länder-VFR-Lücke
  komplett: SI (AD 4) ✅, LT (VFR-Manual) ✅, DK (nur Listen-PDF, Sackgasse) ✅.

## ✅ 0. OpenAIP-Coord-Backfill - ERLEDIGT + APPLY GELAUFEN (14.07.2026)

**Ziel:** Felder mit ICAO aber ohne `airport_facts`-Zeile (Krankenhaus-Heliports
+ kleine ULM/Privatplätze, die OurAirports nicht führt) auf die Karte bringen.
Code: `crawlers/import_openaip_backfill.py` + `GET /api/airport-facts`
(Missing-Liste) + `facts-import.yml` `backfill`-Modus. Doku:
`docs/data-backfill-runbook.md` Abschnitt C.

- `OPENAIP_API_KEY` als Repo-Secret gesetzt (Owner), Dry-run grün (Run
  `29368528625`: 6/8 Beispiele aufgelöst), **`apply` gelaufen** (Run
  `29368834237`).
- **Ergebnis (D1-verifiziert): 34 Zeilen `source='openaip-backfill'`
  geschrieben, Lücke 65 → 30.** Die restlichen 30 kennt auch OpenAIP nicht
  (Hospital-HLPs wie LPLR, Kleinstplätze wie EBAF) - erwarteter Boden; sie
  heilen sich per on-read-Write-back beim Seitenbesuch.
- **✅ Wochenplan:** der `backfill`-Schritt läuft jetzt im wöchentlichen
  `facts-import.yml`-Lauf (So 03:30 UTC, apply-Modus nach dem OurAirports-Import),
  damit künftige neue Felder automatisch Coords bekommen. Manueller Dispatch
  (Dry-run/`apply`/`icaos`) bleibt für Spot-Checks.

## ✅ 0a. Chart-Namen ausgeschrieben (PDC/TRAN) - ERLEDIGT (14.07.2026, gemergt)

`chartDisplayName` schreibt Standard-ICAO-Chart-Codes lokalisiert aus. `PDC` und
`TRAN` (ENAIRE/ES) waren roh; per PDF-Text-Recon der AD-2-LEBL-Charts verifiziert
(PDC = Aircraft Parking/Docking, TRAN = Approach Transition) und ins
`charts.ts`-Glossar aufgenommen (en/de/fr/nl). Merged via PR #264.

## ✅ 0b. Chart-PDF-Abdeckungs-Audit - ERLEDIGT (14.07.2026)

Live gegen alle Live-Länder geprüft: **keine 0-Länder, keine Extraktions-Lücke.**
100% auf CZ/DK/NO/PL/SE/EE/LV/PT/SI/HU/UK/FR/NL/AT/ES (ES nach 0e nun 51/51).
Die zwei niedrigen (BE 22/167, IS 7/53) sind quellseitig korrekt (nur öffentliche
Aerodrome bzw. Hauptflugplätze gechartet), kein Fix nötig. DE bewusst ohne.

## ✅ 0c. Chart-Namen bereinigt (Pfad/Dateiname) - ERLEDIGT (14.07.2026)

BE/PT/SI speicherten den relativen Chart-Href als Name (z.B.
`../graphics/eAIP/EBAW_ADC01_v48.pdf`) - stand roh in der Chart-Box.
`cleanChartName` (Pfad + `.pdf` strippen) in `charts.ts`, plus Designator-Match
auch bei angeklebter Zahl (`ADC01`→ADC). Reine Anzeige-Schicht, unit-getestet.

## ✅ 0d. Windkomponenten-Diagramm korrigiert - ERLEDIGT (14.07.2026)

Owner-Hinweis: die aktive Landerichtung (grün) saß auf der falschen Seite. Fix
(`airport-wind.tsx`): jede Bahn-Bezeichnung sitzt jetzt an ihrer **physischen
Schwelle** (Reziprok-Peilung) - bei Landung 06 setzt man an der SW-Schwelle auf,
wo die "06" gemalt ist (ICAO Annex 14). Für die empfohlene Bahn zusätzlich grüne
Schwellenmarkierung + grüner Pfeil in Landerichtung.

## ✅ 0e. ES 50/51 → 51/51 (LECU/LEVS) - ERLEDIGT (14.07.2026)

Einziges ES-Feld ohne `pdf_url` war **LECU/LEVS** (Madrid/Cuatro Vientos), ein
Doppel-ICAO-Aerodrom unter `LECU_LEVS/`. Die Charts tragen den Doppel-Key
(`LE_AD_2_LECU_LEVS_VAC_1_en.pdf`, per `check_urls` run 29372181084 als 200
verifiziert), den `_CHART_HREF_RE` nicht matchte. `es.py`-Regex um ein
optionales, nicht-fangendes zweites ICAO-Segment erweitert (`([A-Z]{4})(?:_[A-Z]{4})?_...`,
Gruppen-Indizes unverändert), unit-getestet (`tests/test_es.py`). Live
validiert: **ES jetzt 51/51** (Run 29372486590, 943 Charts). Wird beim nächsten
ES-Crawl publiziert.

## 🟡 8. Gated-Länder sichtbar machen (IT/HR/IE/SK) via OurAirports/OpenAIP - SCOPING

**Idee (Owner-Wunsch):** Länder mit paywall-/blockiertem AIP (Italien ENAV,
Kroatien, Irland IAA, Slowakei LPS) mit **Grundabdeckung aus OpenAIP** zeigen
statt gar nicht - Flugplatzliste + Coords + Detailseite ohne Portal-Login.

**🔴 Blocker (Owner-Entscheidung nötig, vor jeder Umsetzung):**
**Lizenz.** OpenAIP ist **CC BY-NC-SA (nicht-kommerziell)**. Die aktuelle Nutzung
ist eine *per-Feld-Anreicherung als Fallback*; OpenAIP als **primäre
Ganzland-Datenquelle** (die komplette Aerodrom-Liste eines Landes) ist eine
andere, deutlich weitergehende Nutzung - und die Site schaltet AdSense
(kommerziell). Das muss lizenzrechtlich geklärt werden (bezahlte OpenAIP-Lizenz,
oder Verzicht auf Ads für diese Länder, oder alternative Quelle), **bevor** ein
gated-Land so onboardet wird. Siehe auch den Lizenz-Hinweis im Backfill-Runbook.

**🟢 Ausweg um den Lizenz-Blocker: OurAirports (CC0) als primäre Quelle.**
OurAirports ist **Public Domain / CC0** (kommerziell erlaubt, keine
Attribution-/NC-Pflicht) und führt bereits Aerodrome für IT/HR/IE/SK (ICAO,
Name, Coords, Typ, Ort - genau die Basis, die der wöchentliche Facts-Import
schon lädt). Damit lässt sich die **Flugplatzliste eines gated-Landes
lizenzsauber** bauen; OpenAIP bliebe wie gehabt nur die *per-Feld-Anreicherung*.
Das verschiebt die Frage von "Lizenz" zu einer **Produktentscheidung**: solche
Länderseiten hätten **keinen AIP-Chart-Link** (der AIP ist gated), also
"Flugplatz-Info"-Seiten (Facts/Wetter/Karte/EFB-Hand-offs/Nearby) statt der
Kern-"finde deine Anflugkarte"-Seite. Passt das zur Marke bzw. reicht der Wert?

**Umfang, falls freigegeben (pro Land, OurAirports-Variante):** kleiner
OurAirports-"Lister" (CSV → Aerodrome des Landes, `closed` raus) → `/api/airports`
(neuer `source`, `url` = OpenAIP-/SkyVector-Deeplink statt AIP) → Locales/Prefix/
Slug in `routing.ts` → `countryTypeAvailability` + `countryMeta` → zwei
Übersetzungsdateien → E2E → Launch-Flag in `liveCountries`. Die Chart-Box
rendert dann einfach nicht (kein `pdf_url`/PDF-`url`), alles fail-soft.

**Italien** ist der Sonderfall: ENAV Self-Briefing ist login-only, kein offener
eAIP (recon 14.07., run 29352948630) - hier ist OurAirports/OpenAIP ohnehin die
einzige Option.

**Empfehlung:** die Produktfrage entscheiden (Info-Seiten ohne Charts ja/nein);
falls ja, **OurAirports-CC0** als Quelle nehmen (umgeht die OpenAIP-NC-Lizenz)
und **ein** Land als Piloten (z.B. IE oder HR) durchziehen, bevor der Rest folgt.

## ✅ 1. `CRON_SECRET` als GitHub-Actions-Secret anlegen (Owner) - ERLEDIGT

Als Repo-Actions-Secret gesetzt. Sorgt für die sofortige Befüllung aller
Flughafenlisten nach jedem Deploy (Post-Deploy-Revalidate) und authentifiziert
die Crawl-/Facts-Workflows gegen `/api/airports` bzw. `/api/airport-facts`.

## ✅ 2. Crawls über GitHub Actions laufen lassen (Owner) - ERLEDIGT (mit Nacharbeiten)

Beide Workflows sind angelegt, die Secrets (`CRON_SECRET`,
`BRIGHTDATA_UNLOCKER_URL`, `BRIGHTDATA_PROXY_URL`) gesetzt, und **beide einmal
manuell ausgelöst** (Airport facts import + Crawl (publish) #1). Die Crawler
laufen als **GitHub-Actions-Workflows auf dem self-hosted Runner** (kein
systemd/bare-metal mehr): kein Code-Drift, Run-Logs + manueller Trigger.

| Workflow | Datei | Zeitplan |
| --- | --- | --- |
| **Crawl (publish)** | `.github/workflows/crawl.yml` | täglich 03:00 UTC + manuell |
| **Airport facts import** | `.github/workflows/facts-import.yml` | wöchentlich So 03:30 UTC + manuell |

### Aktueller Stand: 10 von 12 Ländern live

**Publiziert:** AT (72), NL (24), UK (122), BE (167), CZ (11), NO (55), PL (69),
SE (48) sowie - nach dem Fix (Task 2a) - **DE (792)** und **FR (143)**. Der
`>50%`-Drop-Schutz bleibt erhalten (`crawl.yml` persistiert
`last_run_counts.json` über `actions/cache`).

**Noch nicht live (2 Länder):**

| Land | Problem | Status |
| --- | --- | --- |
| **GR** | Web Unlocker liefert `502 Access denied` | offen, Owner - Task 4 |
| **DK** | AngularJS-SPA, Baum nicht statisch erreichbar | geparkt - Task 3 |

### Verifizieren im Browser (nach dem nächsten Deploy)

- **Listen:** https://aip.aero/pl/ und https://aip.aero/se/ zeigen gefüllte Listen.
- **Karte:** https://aip.aero/de/flughafen-liste-deutschland/ zeigt die
  Leaflet-Karte mit "locate me"-Button (erscheint nur nach dem Facts-Import).
- **Zeitstempel:** dieselbe Seite, "Stand: …" zeigt das Crawl-Datum.

## ✅ 2a. DE + FR reparieren (AIRAC-Zyklus-Regression) - GEFIXT (Claude)

Beide Kernländer-Crawler waren durch AIRAC-Zyklus-Änderungen der Quellen kaputt;
beide sind jetzt gefixt und per Live-Test verifiziert.

- **DE (792 Airports):** DFS liefert die statischen `pages/CNNNNN.html`-
  Einstiegsseiten jetzt als winzige `<meta http-equiv="Refresh">`-Weiterleitungen
  auf die editionsspezifische `…/<AIRAC>/chapter/<hash>.html`. httpx folgt Meta-
  Refreshes nicht → 0 Anchors. Fix: `_fetch()` folgt dem Meta-Refresh und gibt
  die effektive URL zurück; die `myPermalink`-Logik speichert weiter stabile
  `pages/CNNNNN.html`-Permalinks.
- **FR (143 Airports):** SIAs `…/FRANCE/home.html` ist JS-getrieben; `home.js`
  baut den eAIP-Index als `AIRAC-<year>-<month>-<day>/html/index-fr-FR.html`
  (unter einem AIRAC-datierten Unterordner, nicht als flaches Geschwister). Fix:
  die `init()`-Datumsargumente parsen und diesen Pfad konstruieren.

**Publish:** DE (792) + FR (143) wurden nach dem Fix per Crawl (publish) in die
Produktion geschrieben (201 Created, kein Drop-Guard-Block). Die Fixes sind auf
`main` (PR #154) - der **nächtliche** Crawl nutzt sie ab jetzt. Nichts mehr
offen.

## ✅ 3. DK live - ERLEDIGT (14.07.2026, launched)

**DK ist live** (in `liveCountries`), Crawler läuft über die **Naviair-Umbraco-
JSON-API** (browserlos, `dk.py` walkt `getnodesforparent`); Playwright bleibt nur
als Diagnose-Fallback. Letzter Live-Test: **DK OK, 34 Flugplätze**. Der frühere
Befund unten (AngularJS-SPA nicht navigierbar) ist damit **überholt** - die
Lösung war die offene JSON-Tree-API, nicht der SPA-Render. (Historie zur
Nachvollziehbarkeit belassen.)

<details><summary>Historischer Befund (überholt)</summary>

**Erledigt (im Code):** `PlaywrightCrawlerBase` (headless-Chromium, lazy import,
fail-soft), `dk.py` darauf portiert; Live-Test + `crawl.yml` installieren
Chromium pro Lauf automatisch. DK steht noch in `ALLOWED_FAILURES`.

**Befund (Struktur-Diagnose 2026-07-09):** aim.naviair.dk ist eine **AngularJS-
SPA**. Die gerenderte Seite enthält quasi nichts Navigierbares:
- nur **1 Anchor** (`Ændringer til AIP/VFG/AIC`), **kein** "VFR Flight Guide"-Link,
- nur 2 Buttons (Navbar-Toggle + ein `ng-hide`-Button),
- **kein iframe**; einziger struktureller Hinweis: `/templates/treegrid.html`
  (Angular-Tree-Grid-Template).

Der AIP-Baum wird **asynchron per Angular-Route/Klick** in die SPA geladen -
`render_html` erwischt den DOM, **bevor** der Baum befüllt ist, und die Knoten
sind **klickbare Angular-Tree-Items ohne `<a href>`**, kein aus dem HTML
ableitbarer Daten-Endpoint. Der aktuelle text-basierte Link-Follow-Ansatz
(`_follow` sucht `<a>`-Texte) kann das nicht bedienen.

**Nötig für einen Fix (nicht best-effort, größerer Umbau):** `PlaywrightBase`
um **Klick-Navigation + Warten auf Selektor** erweitern (Tree-Item anklicken →
VFG → Part 3 → AD 2 / AD 3 aufklappen) **oder** den Tree-Daten-Endpoint per
Netzwerk-Intercept ermitteln und direkt abfragen. Bis dahin bleibt DK in
`ALLOWED_FAILURES` (schadet nichts - die anderen 11 Länder laufen normal).

→ Ergebnis bei Umsetzung: **11 von 12 Ländern live** (aktuell **10 live**: alle
außer DK und GR)

</details>

## 4. GR: Web Unlocker liefert `502 Access denied` 🟡 (Owner-Diagnose nötig)

**Re-Probe 15.07.2026 (Run 29395569894): unverändert blockiert.** Erste
Anfrage an `https://aisgr.hasp.gov.gr/` -> `502 Forbidden` (2 Retries) ->
`502 Access denied`, weiterhin über die Web-Unlocker-Zone. Kein Fortschritt
ohne die Owner-Schritte unten (Bright-Data-KYC/Domain-Freigabe für die
`.gov.gr`-Regierungsdomain). **Alternativer Weg ohne Bright Data:** GR ist
faktisch ein *gated-Land* (offizieller AIP hart blockiert) - es ließe sich wie
IT/HR/IE/SK über **OurAirports (CC0)** als Info-Seiten *ohne* Chart-Links
onboarden (siehe Task 8, Produktentscheidung).

**✅ Erledigt (Owner):** Web-Unlocker-Zone `aipaero_web_unlocker_gr` angelegt
(CAPTCHA Solver an), Access-URL als Actions-Secret `BRIGHTDATA_UNLOCKER_URL`
gesetzt. **✅ Erledigt (Code):** `gr.py` liest die Variable bevorzugt.

**Problem:** Der Unlocker selbst liefert `502 Access denied` für
`aisgr.hasp.gov.gr` (2 Retries, dann Abbruch) - das kommt **nicht** von unseren
Selektoren. **Wahrscheinlichste Ursache:** `hasp.gov.gr` ist eine
**Regierungsdomain** (`.gov.gr`), die Bright Data aus Compliance-Gründen oft
sperrt oder nur nach KYC-Freigabe durchlässt ("Access denied" ist Bright Datas
eigene Ablehnung, nicht das Ziel).

**Offen (Owner) - Schritt für Schritt:**

1. **Playground:** Zone `aipaero_web_unlocker_gr` → Tab *Playground* → URL
   `https://aisgr.hasp.gov.gr/` senden. Kommt derselbe 502 → Zone/Bright-Data-
   Problem (nicht unser Crawler).
2. **Logs lesen:** Zone → *Logs* → den 502-Request öffnen → **exakten Grund**
   notieren. "Domain not allowed" / "KYC required" / "restricted" → Schritt 4;
   "target blocked/403" → Schritt 5.
3. *(optional)* Per curl gegenprüfen (wie der Crawler, Native proxy access):
   `curl -v -x brd.superproxy.io:33335 -U brd-customer-<ID>-zone-aipaero_web_unlocker_gr:<PW> "https://aisgr.hasp.gov.gr/"`
4. **KYC/Domain-Freigabe:** Account-KYC im Dashboard abschließen; bei Support
   die Domain freischalten lassen (Begründung: **öffentliche AIP-Daten**, keine
   personenbezogenen Daten).
5. **Wenn das Portal selbst blockt:** in der Zone *Premium domains* testweise
   aktivieren und erneut testen.
6. **Grund aus Schritt 2 an Claude** → dann Live-Test auswerten + GR-Selektoren
   nachziehen.

→ Bei Freigabe: **11-12 von 12 Ländern live** (je nach DK). Bleibt es gesperrt,
wird GR ausgeblendet - kein technischer Schaden, alle anderen laufen unabhängig.

## ✅ 5. `docs/pilot-wishlist.md` abarbeiten - WEITGEHEND ERLEDIGT (12.07.2026)

Alle priorisierten Wunschlisten-Items sind umgesetzt (PRs #197-#209: Favorites/
Recents, Customs-Flag + Grenzformular-Links, Karten-Filter, Chart-PDF-Plumbing,
CSP enforced, Country-Bulk-Download, Web-Vitals-/Navigations-Umbau - Lighthouse
live 97-100). **Noch offen** (siehe Wishlist §A/§D): NOTAMs, PPR-Kontakt/
Prozedere, Chart-PDF-Extraktion pro Land (`docs/chart-pdf-plan.md`), weitere
Grenzformular-Länder, weitere Länder (CH/IT/ES, dazu DK/GR live schalten -
Tasks 3/4), EFB-Hand-offs, Customs-Quellen jenseits OpenAIP, OpenAIP-Lizenz
klären.

## 6. Optionale Aufräumarbeiten 🟢 (niedrige Priorität)

- **Runner non-ephemeral machen:** der self-hosted Runner arbeitet die Queue
  aktuell nur langsam ab (jeder Job wartet, weil ephemeral + einzeln). Für
  schnellere manuelle Läufe non-ephemeral konfigurieren.
- **✅ Legacy-Selenium entfernt:** die experimentellen Crawler (`belgium.py`,
  `car_sam_nam.py`, `pac_n.py`, `pac_p.py`, `run.py`), die Selenium-Basen
  (`crawler_base.py`, `eurocontrol_base.py`), das `cache_warmer.py`-Skript und
  die Dependencies `selenium` / `webdriver-manager` sind entfernt. Alle 12
  aktiven Crawler laufen auf httpx (DK via Playwright).
- **Branch-Protection:** Repo-Settings → *Rules → Rulesets* → die 4 CI-Checks
  (`Website (Next.js)`, `Crawlers (Python)`, `E2E & rendered output
  (Playwright)`, `Lighthouse budgets (local)`) als Required Status Checks für
  `main` markieren.
- **AIRAC-Zyklus anzeigen (Feature-Idee):** Die Website zeigt aktuell nur
  "Stand: <Crawl-Datum>" auf der Flughafen-Liste (`last-updated.tsx`), nicht den
  AIRAC-Zyklus. Der Crawler kennt das Editions-Datum aus den Quell-URLs
  (`eAIP_09_JUL_2026`, `2026JUN25` …); ließe sich als "AIRAC 2026-07-09" neben
  "Stand:" ergänzen (Owner-Wunsch, unpriorisiert).

## 7. Nearby-Box voll client-seitig 🟢 (nur falls Error 1102 erneut auftritt)

Vereinbarte Eskalation: tritt der Cloudflare-1102 (Worker-Memory) trotz der
Box-Query (`QUERIES.airportsNear`) wieder auf, wandert `airport-nearby.tsx`
komplett client-seitig hinter einen kleinen API-Endpunkt (wie Karte/Wetter) -
dann verlaesst auch die Box-Query den SSR-Pfad. Trade-off: die Nearby-Links
stehen dann nicht mehr im Server-HTML. **Nicht proaktiv umsetzen; der Owner
meldet sich, wenn es soweit ist.**

## ✅ Website-Verbesserungen 10.07.2026 (PRs #156-#172, alle gemergt)

Redesign (globale + Laender-Startseiten, Inter-Font, Kartenlook), Cloudflare-
1102-Fixes (Map-Marker client-seitig via `/api/airport-coords`, Nearby-Box-Query,
CD-Warm-up), Performance (inlineCss, lazy Leaflet-CSS + Map-Defer, lazy
Chart-PDF-Preview, CLS-Fixes), SEO (x-default-hreflang, Sitenav als
multi-typisierter CollectionPage/ItemList-Knoten, DigitalDocument fuer
Chart-PDFs, Schema-Dedup via Layout), i18n (Sprachumschalter se/cz/dk/gr,
AT-Flagge, "Nederlands"), UX (AIP-Badge, Anker-Headings, Trade:Aero auf
Detailseiten inkl. Mobile-Fix). Details: CLAUDE.md ist auf diesem Stand.

## Zuletzt behobene Website-Bugs (inzwischen auf `main` deployt)

- **"Flugplätze in der Nähe"**: auf 4 Einträge begrenzt und als zentrierter
  Blocksatz-Block gerendert (`airport-nearby.tsx`); Query inzwischen als
  Bounding-Box (`airportsNear`, s. Task 7).
- **"Find my location"-Button** (Karte): Der `Permissions-Policy`-Header
  schickte `geolocation=()` und deaktivierte die Geolocation-API seitenweit -
  auf `geolocation=(self)` korrigiert (`next.config.mjs`); Handler mit
  Error-Callback + lokalisierter Fehlermeldung gehärtet.

---

**Reihenfolge-Empfehlung:** 2a (DE/FR-Fix, läuft) zuerst - das sind Kernländer.
Parallel 4 (GR-502 im Bright-Data-Dashboard prüfen). Danach 3 (DK), dann 5.

## ✅ Website-Verbesserungen 12.07.2026 (PRs #197-#209, alle gemergt)

PWA Country-Bulk-Download (Phase 4) inkl. Scope-Hinweis; Wishlist-Batch
(Favorites/Recents, Customs + Grenzformulare, Karten-Filter, pdf_url-Plumbing,
CSP enforced); Web-Vitals-Pass (Font display:optional, main min-h-screen
CLS-Fix, eine Cached-Query pro Land, Karten-Input-Gating, Icon-Sprite +
content-visibility, Warm-ups, feingranulare Facts-Invalidierung); Navigation
server-gerendert (mobile Pill-Bar statt Hamburger-Dialog, Link-Sprachumschalter,
-43 kB First-Load-JS, vaul/@radix-ui-select/cva entfernt); Flughafenlisten-Karte
auf den Landing-Pages; Breadcrumb horizontal scrollbar + lokalisierte
Titles/aria-Labels. Live-Lighthouse nach Deploy: 97-100 in allen Kategorien.
Details: CLAUDE.md ist auf diesem Stand.
