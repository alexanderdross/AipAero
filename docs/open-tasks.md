# AIP:Aero - Offene Aufgaben (Stand: 09.07.2026)

Status-Legende: 🔴 blockiert Folgearbeiten / heute erledigen · 🟡 als Nächstes · 🟢 danach / optional

## 1. `CRON_SECRET` als GitHub-Actions-Secret anlegen 🔴 (Owner, 5 Min.)

Sorgt für die **sofortige** Befüllung aller Flughafenlisten nach jedem Deploy
(ohne Secret: bis zu 1h Verzögerung via ISR-Sicherheitsnetz). Stand jetzt
offen - der CD-Step wird mangels Secret in 0 Sekunden übersprungen.

1. Wert des Worker-Secrets `CRON_SECRET` bereithalten (identisch mit dem
   `API_KEY` der Crawler auf dem netcup-Host).
2. GitHub → `alexanderdross/AipAero` → **Settings → Secrets and variables →
   Actions → New repository secret**.
3. Name: `CRON_SECRET` (exakt), Value: der Secret-Wert → **Add secret**.
4. **Verifizieren:** Nächster Push auf `main` → CD-Workflow-Log → Step
   *"Revalidate all countries"* zeigt `{"revalidated": ["country:AT", ...]}`
   mit HTTP 200 (statt sofort zu überspringen).

## 2. Crawls über GitHub Actions laufen lassen 🔴 (Owner, ~5 Min.)

Die Crawler laufen **nicht** mehr per systemd auf einem bare-metal netcup,
sondern als **GitHub-Actions-Workflows auf dem self-hosted Runner** (der auf
der Coolify/netcup-Box ohnehin schon läuft und auch den Live-Test ausführt).
Vorteil: kein Code-Drift (frischer Checkout je Lauf), Run-Logs + manueller
Trigger, kein Crawler-Dockerfile / kein `playwright install`-ins-Image nötig.

Der erste Lauf schaltet drei Dinge frei, die im Code schon live sind, aber
Daten aus einem Lauf brauchen: **(a)** gefüllte Listen für BE/CZ/NO/PL/SE,
**(b)** die **Karte + "Flugplätze in meiner Nähe"** auf der Flughafen-Liste
(die Bulk-Karte joint `airport_facts`, braucht also die Koordinaten aus dem
OurAirports-Import), **(c)** den **echten per-Country-Crawl-Zeitstempel**
("Stand: …" auf der Flughafen-Liste, statt Build-Datum-Fallback).

**Nicht mehr blockierend:** Die **Aerodrome-Facts-Karte + Seitenwind-Box auf den
Detailseiten** funktionieren jetzt auch ohne diesen Import - sie ziehen
Koordinaten / Höhe / Pisten / Frequenzen zur Laufzeit aus der kostenlosen
AWC/NOAA-"airport"-API (`src/lib/awc-airport.ts`, kein Key nötig). Der Import
bleibt trotzdem sinnvoll: er liefert Ort + offizielle Website und speist die
Bulk-Karte.

Zwei Workflows (im Repo bereits angelegt):

| Workflow | Datei | Zeitplan | Zweck |
| --- | --- | --- | --- |
| **Crawl (publish)** | `.github/workflows/crawl.yml` | täglich 03:00 UTC | Crawlt alle Länder, POSTet an `/api/airports` → füllt Listen + schreibt `crawl_meta` (echter Zeitstempel) |
| **Airport facts import** | `.github/workflows/facts-import.yml` | wöchentlich So 03:30 UTC | OurAirports-Import → `airport_facts` (Koordinaten → **Karte**, Elevation/Pisten/Frequenzen) |

Beide sind auch **manuell** triggerbar (Actions → Workflow wählen → *Run
workflow*); `crawl.yml` akzeptiert optional einzelne Länder-Codes.

### Schritt 2.1 - GitHub-Actions-Secrets prüfen/setzen

Beide Workflows brauchen `CRON_SECRET` (identisch zum Worker-Secret). GR
zusätzlich `BRIGHTDATA_UNLOCKER_URL`. Unter **Settings → Secrets and variables
→ Actions**:

- `CRON_SECRET` (Pflicht - auch für den Post-Deploy-Revalidate, Task 1)
- `BRIGHTDATA_UNLOCKER_URL` (für GR, siehe Task 4; ohne sie bleibt GR blockiert,
  alle anderen Länder laufen normal)
- `BRIGHTDATA_PROXY_URL` (optional/Fallback)

### Schritt 2.2 - Runner online + einmalig manuell auslösen

1. Sicherstellen, dass der self-hosted Runner **online** ist (Settings →
   Actions → Runners; idealerweise **non-ephemeral**, sonst arbeitet er die
   Queue nur langsam ab - siehe Task 7).
2. **Airport facts import** einmal manuell starten (Actions → *Airport facts
   import* → *Run workflow*) → füllt `airport_facts` (Karte + Facts-Karten).
3. **Crawl (publish)** einmal manuell starten → füllt Listen + Zeitstempel,
   statt bis 03:00 UTC zu warten.

### Schritt 2.3 - Verifizieren im Browser

- **Listen:** https://aip.aero/pl/ und https://aip.aero/se/ zeigen gefüllte
  Listen.
- **Karte:** https://aip.aero/de/flughafen-liste-deutschland/ zeigt oberhalb
  der Listen die Leaflet-Karte mit "locate me"-Button (erscheint nur nach dem
  Facts-Import).
- **Zeitstempel:** dieselbe Seite, die **"Stand: …"**-Zeile zeigt jetzt das
  Crawl-Datum statt des Build-Datums.
- **Facts-Karte:** eine Detailseite wie https://aip.aero/de/vfr/?EDNY zeigt die
  Aerodrome-Daten-Box (Elevation/Pisten/Frequenzen).

> Der `>50%`-Drop-Schutz (Parser-Bug-Absicherung) bleibt erhalten: `crawl.yml`
> persistiert `last_run_counts.json` über `actions/cache` zwischen den Läufen.

## 3. DK live verifizieren + freischalten 🟡 (Code fertig - Owner-Schritt offen)

**Erledigt (im Code):** `PlaywrightCrawlerBase` (headless-Chromium-Render,
lazy import, fail-soft) gebaut, `dk.py` darauf portiert (rendert die JS-App
statt sie zu fetchen), `playwright`-Dependency + `uv.lock`. Sowohl der
Live-Test als auch `crawl.yml` installieren Chromium pro Lauf automatisch -
**kein Host-Schritt nötig**. DK steht noch in `ALLOWED_FAILURES`.

**Offen:**
1. **Claude:** Live-Crawl-Test für DK auswerten. Die genaue gerenderte
   DOM-Struktur von aim.naviair.dk ist noch unverifiziert - je nach Ergebnis
   die Menü-Navigation nachziehen (dieselbe Diagnose-Schleife wie bei den
   anderen Ländern).
2. **Claude:** Bei plausibler Airport-Zahl DK in `liveCountries`
   (`src/lib/utils.ts`) + Startseiten-Karte (`src/app/page.tsx`) freischalten
   und aus `ALLOWED_FAILURES` entfernen.

→ Ergebnis: **11 von 12 Ländern live**

## 4. GR über Bright Data Web Unlocker 🟡 (Code fertig - Owner-Schritt offen)

GR (aisgr.hasp.gov.gr) ist **serverseitig reCAPTCHA-geschützt** (verifiziert:
`main.php` leitet ohne Captcha-Session zum Gate zurück) - Playwright hilft
dort nicht, nur ein Unlocker-Dienst. Kosten bei nightly Crawls: Cent-Bereich
(wenige Requests pro Nacht).

**Erledigt (im Code):** `gr.py` liest jetzt `BRIGHTDATA_UNLOCKER_URL`
bevorzugt (Fallback: `BRIGHTDATA_PROXY_URL`); Live-Test reicht die Variable
durch.

**Offen:**
1. **Owner:** Im Bright-Data-Dashboard eine **Web Unlocker**-Zone anlegen
   (eigenes Produkt, nicht die bestehende Proxy-Zone).
2. **Owner:** Access-Parameter als GitHub-Actions-Secret
   `BRIGHTDATA_UNLOCKER_URL` anlegen (Format `http://user:pass@host:port`,
   `http://`-Schema optional). Der `crawl.yml`-Workflow reicht es automatisch
   an den GR-Crawler durch - kein Host-Schritt nötig.
3. **Claude:** Live-Test für GR auswerten, ggf. die AD-Section-Selektoren
   gegen die (dann sichtbare) echte Navigation nachziehen, GR freischalten.

→ Ergebnis: **12 von 12 Ländern live** (Alternative: GR bleibt ausgeblendet,
kein technischer Schaden)

## 5. `docs/pilot-wishlist.md` abarbeiten 🟢 (Claude - nach 3./4.)

Ursprünglich zurückgestellte Anfrage ("erst weitere Länder"). **Wichtig:**
Erst Abgleich gegen den aktuellen Stand - parallel wurden bereits umgesetzt:
Aerodrome-Facts (OpenAIP + OurAirports + AWC/NOAA), globale Cross-Country-Suche,
METAR/TAF-Decode-Tab, Wetter-Gadgets, Sitelinks Search Box. Ablauf: Liste
lesen → erledigte Punkte markieren → Priorisierung einholen → umsetzen.

## 6. Optionale Aufräumarbeiten 🟢 (niedrige Priorität)

- **Legacy-Selenium entfernen:** experimentelle Crawler (`belgium.py`,
  `car_sam_nam.py`, `pac_n.py`, `pac_p.py`, `run.py`) löschen oder portieren,
  dann `crawler_base.py` + `eurocontrol_base.py` + die Dependencies
  `selenium`/`webdriver-manager` in einem Commit entfernen.
- **Branch-Protection:** Repo-Settings → *Rules → Rulesets* → die 4 CI-Checks
  (`Website (Next.js)`, `Crawlers (Python)`, `E2E & rendered output
  (Playwright)`, `Lighthouse budgets (local)`) als Required Status Checks für
  `main` markieren.

---

**Reihenfolge-Empfehlung:** 1 + 2 zuerst (macht den 10-Länder-Rollout
komplett und selbstheilend), dann 3 (DK) starten und parallel 4 (GR-Zone)
anlegen, danach 5.
