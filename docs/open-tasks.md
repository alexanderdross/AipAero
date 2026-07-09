# AIP:Aero - Offene Aufgaben (Stand: 09.07.2026)

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

### Ergebnis des ersten Publish-Laufs: 8 von 12 Ländern live

**Publiziert (201 Created):** AT (72), NL (24), UK (122), BE (167), CZ (11),
NO (55), PL (69), SE (48). Der `>50%`-Drop-Schutz bleibt erhalten (`crawl.yml`
persistiert `last_run_counts.json` über `actions/cache`).

**Vier mit Problemen** - siehe Tasks 2a / 3 / 4:

| Land | Problem |
| --- | --- |
| **DE** | Crawler parst 0 (DFS hat die Einstiegsseiten/Markup geändert) - Task 2a |
| **FR** | Editions-Einstieg geändert (kein `index-fr-FR.html` mehr) - Task 2a |
| **GR** | Web Unlocker liefert `502 Access denied` - Task 4 |
| **DK** | Naviair-Seite hat die VFG-Navigation geändert - Task 3 |

> **Kein Datenverlust:** DE/FR brachen **vor** dem POST ab, es wurde nichts
> gelöscht. Die Website zeigt für DE/FR weiter die bestehenden Listen; sie
> werden nur nicht aktualisiert, bis der Fix greift.

### Verifizieren im Browser (nach dem nächsten Deploy)

- **Listen:** https://aip.aero/pl/ und https://aip.aero/se/ zeigen gefüllte Listen.
- **Karte:** https://aip.aero/de/flughafen-liste-deutschland/ zeigt die
  Leaflet-Karte mit "locate me"-Button (erscheint nur nach dem Facts-Import).
- **Zeitstempel:** dieselbe Seite, "Stand: …" zeigt das Crawl-Datum.

## 2a. DE + FR reparieren (AIRAC-Zyklus-Regression) 🔴 (Claude - in Arbeit)

Beide Kernländer-Crawler brechen seit dem aktuellen AIRAC-Zyklus: die Quellen
haben ihre Einstiegs-URLs/Markup verschoben.

- **FR:** Navigation läuft korrekt bis `…/eAIP_09_JUL_2026/FRANCE/home.html`
  (HTTP 200), aber der `<object>` zeigt jetzt direkt auf eine **konkrete
  Edition** statt auf den Multi-Editions-Index mit `index-fr-FR.html`.
- **DE:** beide DFS-Forks (BasicVFR/BasicIFR) laden (200), liefern aber 0
  `folder-link`-Elemente - DFS hat vermutlich Klasse/Struktur der
  Einstiegsseiten geändert.

**Ablauf:** Diagnose-Logging in `fr.py`/`de.py` (temporärer Commit) → Live-Test
auf dem Branch → echte Struktur auslesen → Selektoren fixen → verifizieren.
Läuft. Kein Owner-Schritt.

## 3. DK live verifizieren + freischalten 🟡 (Claude)

**Erledigt (im Code):** `PlaywrightCrawlerBase` (headless-Chromium, lazy import,
fail-soft), `dk.py` darauf portiert; Live-Test + `crawl.yml` installieren
Chromium pro Lauf automatisch. DK steht noch in `ALLOWED_FAILURES`.

**Befund aus dem ersten Lauf:** Playwright rendert die Seite korrekt, aber der
erwartete "VFR Flight Guide"-Navigationslink fehlt (aim.naviair.dk hat die
Struktur geändert - aktuell nur ein "Ændringer"-Link sichtbar). Selektoren
gegen die neue DOM nachziehen, dann DK in `liveCountries` (`src/lib/utils.ts`)
+ Startseiten-Karte (`src/app/page.tsx`) freischalten.

→ Ergebnis: **11 von 12 Ländern live**

## 4. GR: Web Unlocker liefert 502 🟡 (Owner-Blick nötig)

GR (aisgr.hasp.gov.gr) ist serverseitig reCAPTCHA-geschützt - nur ein
Unlocker-Dienst kommt durch.

**✅ Erledigt (Owner):** Web-Unlocker-Zone `aipaero_web_unlocker_gr` angelegt
(CAPTCHA Solver an), Access-URL als Actions-Secret `BRIGHTDATA_UNLOCKER_URL`
gesetzt. **✅ Erledigt (Code):** `gr.py` liest die Variable bevorzugt.

**Problem:** Der Unlocker selbst liefert `502 Access denied` für
`aisgr.hasp.gov.gr` (2 Retries, dann Abbruch) - das kommt **nicht** von
unseren Selektoren, sondern der Web Unlocker erreicht die Zielseite nicht.

**Offen (Owner):** Im Bright-Data-Dashboard prüfen, warum die Domain 502 gibt
(ggf. Domain in der Zone freischalten / Premium-Domains testweise aktivieren /
Bright-Data-Support fragen, ob `hasp.gov.gr` unterstützt wird). Sobald der
Unlocker durchkommt, wertet **Claude** den Live-Test aus und zieht die
AD-Section-Selektoren gegen die dann sichtbare Navigation nach.

→ Ergebnis: **12 von 12 Ländern live** (Alternative: GR bleibt ausgeblendet,
kein technischer Schaden)

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

## Zuletzt behobene Website-Bugs (auf dem Branch, noch nicht auf `main`)

- **"Flugplätze in der Nähe"**: auf 4 Einträge begrenzt und als zentrierter
  Blocksatz-Block gerendert (`airport-nearby.tsx`).
- **"Find my location"-Button** (Karte): Der `Permissions-Policy`-Header
  schickte `geolocation=()` und deaktivierte die Geolocation-API seitenweit -
  auf `geolocation=(self)` korrigiert (`next.config.mjs`); Handler mit
  Error-Callback + lokalisierter Fehlermeldung gehärtet. **Greift erst nach
  dem nächsten Deploy.**

---

**Reihenfolge-Empfehlung:** 2a (DE/FR-Fix, läuft) zuerst - das sind Kernländer.
Parallel 4 (GR-502 im Bright-Data-Dashboard prüfen). Danach 3 (DK), dann 5.
