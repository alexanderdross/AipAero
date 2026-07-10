# AIP:Aero - Offene Aufgaben (Stand: 10.07.2026)

Status-Legende: 🔴 blockiert Folgearbeiten / heute erledigen · 🟡 als Nächstes · 🟢 danach / optional · ✅ erledigt

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

## 3. DK live verifizieren + freischalten 🟡 (Claude)

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

## 4. GR: Web Unlocker liefert `502 Access denied` 🟡 (Owner-Diagnose nötig)

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

## 5. `docs/pilot-wishlist.md` abarbeiten 🟢 (Claude - nach 2a/3/4)

Erst Abgleich gegen den aktuellen Stand - parallel wurden bereits umgesetzt:
Aerodrome-Facts (OpenAIP + OurAirports + AWC/NOAA), globale Cross-Country-Suche,
METAR/TAF-Decode-Tab, Wetter-Gadgets, Sitelinks Search Box. Ablauf: Liste
lesen → erledigte Punkte markieren → Priorisierung einholen → umsetzen.

## 6. Optionale Aufräumarbeiten 🟢 (niedrige Priorität)

- **Runner non-ephemeral machen:** der self-hosted Runner arbeitet die Queue
  aktuell nur langsam ab (jeder Job wartet, weil ephemeral + einzeln). Für
  schnellere manuelle Läufe non-ephemeral konfigurieren.
- **Legacy-Selenium entfernen:** experimentelle Crawler (`belgium.py`,
  `car_sam_nam.py`, `pac_n.py`, `pac_p.py`, `run.py`) löschen oder portieren,
  dann `crawler_base.py` + `eurocontrol_base.py` + die Dependencies
  `selenium`/`webdriver-manager` in einem Commit entfernen.
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
