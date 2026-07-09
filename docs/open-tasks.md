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

## 2. netcup-Crawler-Host einrichten 🔴 (Owner, ~15 Min.)

Ein Rundum-Update des Crawler-Hosts. Es schaltet drei Dinge frei, die im Code
schon live sind, aber Daten aus einem Host-Lauf brauchen:
**(a)** gefüllte Listen für BE/CZ/NO/PL/SE, **(b)** die **Karte + "Flugplätze
in meiner Nähe"** auf der Flughafen-Liste (die Bulk-Karte joint `airport_facts`,
braucht also die Koordinaten aus dem OurAirports-Import), **(c)** den **echten
per-Country-Crawl-Zeitstempel** ("Stand: …" auf der Flughafen-Liste, statt
Build-Datum-Fallback).

**Nicht mehr blockierend:** Die **Aerodrome-Facts-Karte + Seitenwind-Box auf den
Detailseiten** funktionieren jetzt auch ohne diesen Import - sie ziehen
Koordinaten / Höhe / Pisten / Frequenzen zur Laufzeit aus der kostenlosen
AWC/NOAA-"airport"-API (`src/lib/awc-airport.ts`, kein Key nötig). Der Import
bleibt trotzdem sinnvoll: er liefert Ort + offizielle Website und speist die
Bulk-Karte.

### Schritt 2.1 - Code + Abhängigkeiten aktualisieren

```bash
# per SSH auf dem netcup-Server, im Repo-Verzeichnis:
git pull origin main
cd crawlers
uv sync --frozen

# Headless-Chromium fuer den DK-Crawler (JS-Rendering-Fallback) - einmalig:
uv run playwright install chromium --with-deps
```

### Schritt 2.2 - Bright-Data-Zonen als Env-Vars hinterlegen (fuer GR)

```bash
sudo systemctl edit aip-crawler.service
# im Editor einfuegen (Werte aus dem Bright-Data-Dashboard):
#   [Service]
#   Environment="BRIGHTDATA_UNLOCKER_URL=<Web-Unlocker-Zone-URL>"
#   Environment="BRIGHTDATA_PROXY_URL=<Plain-Proxy-URL>"   # optional/Fallback
sudo systemctl daemon-reload
```

`BRIGHTDATA_UNLOCKER_URL` loest das GR-Captcha (siehe Task 4); ohne sie bleibt
GR blockiert, alle anderen Laender laufen aber normal.

### Schritt 2.3 - OurAirports-Import einmalig ausführen (Karte + Facts)

Befuellt die `airport_facts`-Tabelle mit Koordinaten/Pisten/Frequenzen. **Erst
danach erscheinen die Karte und die Aerodrome-Facts-Karten.** Der Importer
deckt automatisch alle Laender ab und braucht `API_BASE` + `API_KEY` (identisch
zum Crawler-`CRON_SECRET`):

```bash
# im crawlers-Verzeichnis, mit denselben API-Zugangsdaten wie der Crawler:
API_BASE="https://aip.aero" API_KEY="<CRON_SECRET>" \
  uv run python import_ourairports.py
# Erwartung: "Built N airport-facts rows; posting to https://aip.aero/api/airport-facts" -> 200/201
```

(Nur einmalig noetig; danach bei Bedarf wiederholen, wenn OurAirports neue
Daten hat. Ein systemd-Timer dafuer ist optional.)

### Schritt 2.4 - Regulären Crawl anstoßen (Listen + Zeitstempel)

```bash
sudo systemctl start aip-crawler.service
journalctl -u aip-crawler.service -f
```

**Erwartung im Log:** pro Land `Found N airports` (BE 167, CZ 11, NO 55,
PL 69, SE 48) und `POST /api/airports` → 201. Jeder POST schreibt zugleich die
`crawl_meta`-Tabelle → der **Crawl-Zeitstempel** wird ab jetzt echt.

### Schritt 2.5 - Verifizieren im Browser

- **Listen:** https://aip.aero/pl/ und https://aip.aero/se/ zeigen gefüllte
  Listen.
- **Karte:** https://aip.aero/de/flughafen-liste-deutschland/ zeigt oberhalb
  der Listen die Leaflet-Karte mit "locate me"-Button (erscheint nur, wenn
  Schritt 2.3 lief und Koordinaten vorhanden sind).
- **Zeitstempel:** dieselbe Seite, die **"Stand: …"**-Zeile unter dem Titel
  zeigt jetzt das Crawl-Datum (nach Schritt 2.4), nicht mehr das Build-Datum.
- **Facts-Karte:** eine Detailseite wie https://aip.aero/de/vfr/?EDNY zeigt die
  Aerodrome-Daten-Box (Elevation/Pisten/Frequenzen).

## 3. DK live verifizieren + freischalten 🟡 (Code fertig - Owner-Schritt offen)

**Erledigt (im Code):** `PlaywrightCrawlerBase` (headless-Chromium-Render,
lazy import, fail-soft) gebaut, `dk.py` darauf portiert (rendert die JS-App
statt sie zu fetchen), `playwright`-Dependency + `uv.lock`, der Live-Test
installiert Chromium automatisch. DK steht noch in `ALLOWED_FAILURES`.

**Offen:**
1. **Owner (netcup-Host):** Chromium installieren - erledigt durch Schritt 2.1
   (`uv run playwright install chromium --with-deps`).
2. **Claude:** Live-Crawl-Test für DK auswerten. Die genaue gerenderte
   DOM-Struktur von aim.naviair.dk ist noch unverifiziert - je nach Ergebnis
   die Menü-Navigation nachziehen (dieselbe Diagnose-Schleife wie bei den
   anderen Ländern).
3. **Claude:** Bei plausibler Airport-Zahl DK in `liveCountries`
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
2. **Owner:** Access-Parameter als GitHub-Secret `BRIGHTDATA_UNLOCKER_URL`
   anlegen (Format `http://user:pass@host:port`, `http://`-Schema optional) +
   später als Env-Var auf dem netcup-Host.
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
