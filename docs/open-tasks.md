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

## 2. netcup-Crawler-Host aktualisieren 🔴 (Owner, 10 Min.)

Ohne dieses Update crawlen die 5 neuen Länder (BE, CZ, NO, PL, SE) nachts
nicht.

```bash
# per SSH auf dem netcup-Server, im Repo-Verzeichnis:
git pull origin main
cd crawlers
uv sync --frozen

# Bright-Data-Proxy fuer den Service hinterlegen (fuer GR):
sudo systemctl edit aip-crawler.service
# im Editor einfuegen:
#   [Service]
#   Environment="BRIGHTDATA_PROXY_URL=<Bright-Data-Wert>"
sudo systemctl daemon-reload

# Testlauf + Log:
sudo systemctl start aip-crawler.service
journalctl -u aip-crawler.service -f
```

**Erwartung im Log:** pro Land `Found N airports` (BE 168, CZ 11, NO 55,
PL 69, SE 48) und `POST /api/airports` → 201.
**Schnelltest im Browser:** https://aip.aero/pl/ und https://aip.aero/se/
zeigen gefüllte Listen.

## 3. Playwright-Fallback bauen + DK portieren 🟡 (Claude - Startsignal genügt)

Empfohlener Weg für JS-gerenderte AIP-Quellen (DK jetzt, künftige Länder
später). Hintergrund: aim.naviair.dk ist eine JS-App ohne serverseitige
Links; auch SE/PL liefern bereits parallele `index-v2.html`-JS-Viewer aus -
JS-Rendering wird der häufigste Blocker neuer Quellen sein.

1. Playwright-(Python)-Fallback-Pfad in die Crawler-Basis (`crawlers/`) -
   läuft nur auf netcup / Self-hosted-Runner, nie auf Workers/Vercel (die in
   CLAUDE.md vorgesehene einzige Browser-Ausnahme).
2. `dk.py` auf den Fallback portieren.
3. Validierung über den Live-Crawl-Test (`crawler-live-test.yml`), dann DK in
   `liveCountries` (`src/lib/utils.ts`) + Startseiten-Karte
   (`src/app/page.tsx`) freischalten.
4. Host-Voraussetzung danach auf netcup: `uv sync --frozen` +
   `uv run playwright install chromium --with-deps`.

→ Ergebnis: **11 von 12 Ländern live**

## 4. GR über Bright Data Web Unlocker 🟡 (Owner + Claude)

GR (aisgr.hasp.gov.gr) ist **serverseitig reCAPTCHA-geschützt** (verifiziert:
`main.php` leitet ohne Captcha-Session zum Gate zurück) - Playwright hilft
dort nicht, nur ein Unlocker-Dienst. Kosten bei nightly Crawls:
Cent-Bereich (wenige Requests pro Nacht).

1. **Owner:** Im Bright-Data-Dashboard eine **Web Unlocker**-Zone anlegen
   (eigenes Produkt, nicht die bestehende Proxy-Zone).
2. **Owner:** Access-Parameter als GitHub-Secret `BRIGHTDATA_UNLOCKER_URL`
   anlegen (Format wie gehabt, `http://`-Schema optional) + später als
   Env-Var auf dem netcup-Host.
3. **Claude:** `gr.py` auf die Unlocker-Zone umstellen, per Live-Test
   validieren, GR freischalten.

→ Ergebnis: **12 von 12 Ländern live** (Alternative: GR bleibt ausgeblendet,
kein technischer Schaden)

## 5. `docs/pilot-wishlist.md` abarbeiten 🟢 (Claude - nach 3./4.)

Ursprünglich zurückgestellte Anfrage ("erst weitere Länder"). **Wichtig:**
Erst Abgleich gegen den aktuellen Stand - parallel wurden bereits umgesetzt:
Aerodrome-Facts (OurAirports + OpenAIP), globale Cross-Country-Suche,
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
