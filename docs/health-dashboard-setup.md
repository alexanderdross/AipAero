# Health-Dashboard - Setup-Anleitung (Owner)

Schritt-fuer-Schritt-Checkliste, um das Health-Dashboard live zu bringen. Der
**gesamte Code ist gebaut und in `main` gemergt** (Konzept + Architektur:
`docs/health-dashboard-concept.md`); es fehlt nur noch die **Owner-Infrastruktur**
auf der Cloudflare- und der Coolify/netcup-Seite.

Reihenfolge einhalten:
**1 (DB - erledigt) -> 2 (Deploy - erledigt) -> 3-6 (Token) -> 7 (Collector) ->
8 (Dashboard-App) -> 9 (Tunnel + Access) -> 10 (Verifikation).**
Ohne die Token (3-6) sammelt der Collector nur die lokalen Server-Metriken; ohne
9 (Access) waere das Dashboard oeffentlich.

Legende: `[x]` = erledigt, `[ ]` = offen, `code` = ausfuehren/eintragen.

---

## 1. Datenbank-Migration - ERLEDIGT

Die Tabelle `aip_aero_v4_health_metrics` (Migration `0012_dazzling_crystal.sql`)
ist beim Merge von PR #402 via `cd.yml` auf die Remote-D1 angewendet worden.

- [x] Migration `0012` auf Prod-D1 aktiv.
- [ ] (Nur zur Kontrolle) pruefen, dass die Tabelle existiert:
  ```bash
  wrangler d1 execute DB --remote \
    --command "SELECT name FROM sqlite_master WHERE name='aip_aero_v4_health_metrics';"
  ```

## 2. Deploy + Ingest-Smoke-Test - Code ist live

Der Worker mit `/api/health` (POST/GET), der server-seitigen Sentry-Erfassung
und dem Client-Fehler-Beacon ist deployt.

- [x] `/api/health` in Produktion verfuegbar.
- [ ] Smoke-Test des Ingest (mit dem echten `CRON_SECRET`):
  ```bash
  curl -sS -X POST "https://aip.aero/api/health" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '[{"recordedAt":'$(date +%s)',"category":"server","metric":"ram_used_pct","value":42,"unit":"pct"}]'
  # -> {"message":"Inserted 1 health metrics","inserted":1}
  curl -sS "https://aip.aero/api/health?category=server" \
    -H "Authorization: Bearer $CRON_SECRET"
  # -> {"count":1,"metrics":[...]}
  ```

## 3. Cloudflare API-Token (Analytics + D1 read)

- [ ] Cloudflare-Dashboard -> My Profile -> API Tokens -> **Create Token** (Custom):
  - Permissions: **Account > Account Analytics > Read**,
    **Account > D1 > Read**, **Zone > Analytics > Read** (Zone = `aip.aero`).
  - Token kopieren -> spaeter `CLOUDFLARE_ANALYTICS_TOKEN` (Schritt 7).
- [ ] Account-ID + Zone-ID notieren (Dashboard-Uebersicht). Die D1-Database-ID
  steht in `wrangler.jsonc` (`DB` -> `2600ff55-5ffb-442e-9d85-acf5b99dd8ad`).

> Hinweis: Die GraphQL-Feldnamen (v.a. RUM-Web-Vitals-Quantile) sind best-effort
> gesetzt; der Parser (`crawlers/health/cloudflare_parse.py`) ist defensiv -
> unbekannte Felder werden still uebersprungen. Beim ersten echten Lauf im
> Collector-Log kurz gegenchecken, ob die erwarteten Metriken kommen.

## 4. Coolify API-Token

- [ ] In Coolify -> **Keys & Tokens -> API Tokens** -> neuen Token (read) erzeugen.
- [ ] Coolify-API-URL notieren (typisch `http://localhost:8000`, da der Collector
  auf derselben Box laeuft). -> `COOLIFY_API_URL` / `COOLIFY_API_TOKEN`.

> Der Collector liefert daraus die App-/Resource-Health (running/unhealthy/
> stopped) UND - sofern die `/api/v1/servers`-Antwort Nutzungswerte traegt -
> per-Server CPU/RAM/Disk. Die Box-Auslastung selbst kommt ohnehin schon via
> psutil (Server-Kachel), ganz ohne Token.

## 5. GitHub-Token

- [ ] Fine-grained PAT fuer `alexanderdross/aipaero` mit **Contents: Read** +
  **Actions: Read** + **Issues: Read** (oder klassischer PAT mit `repo` +
  `read:org`). -> `GITHUB_TOKEN`. Fuellt die Issues-Kachel mit offenen Issues +
  fehlgeschlagenen Workflow-Laeufen (crawl/facts-import/cd/ci).

## 6. Sentry (optional, aktiviert die Fehlererfassung)

Die Fehlererfassung ist **schon gebaut** - server-seitig im Worker
(`src/lib/sentry.ts`, `captureServerError` in den API-Routen) UND client-seitig
(Browser-Fehler -> `/api/client-error` -> Sentry, First-Party-Beacon ohne SDK/
CSP-Aenderung). Beide sind **inert, bis das DSN gesetzt ist**.

- [ ] Sentry-Projekt anlegen; `SENTRY_ORG` + `SENTRY_PROJECT` notieren.
- [ ] **DSN als Worker-Secret** setzen (schaltet die Erfassung scharf):
  ```bash
  wrangler secret put SENTRY_DSN
  ```
  Optional `SENTRY_ENVIRONMENT` als `var` in `wrangler.jsonc` (sonst = `NODE_ENV`).
- [ ] Auth-Token (Sentry -> Settings -> Auth Tokens, Scope `project:read`,
  `event:read`) -> `SENTRY_AUTH_TOKEN` fuer den Collector (`sentry.py` zaehlt die
  unresolved Issues fuer die Issues-Kachel).

## 7. Collector auf der Box einrichten

Der Collector liegt im Repo (`crawlers/health_collector.py`) und laeuft auf der
Coolify/netcup-Box (dort, wo schon die Crawler laufen). Jeder Gatherer ist
fail-soft: eine nicht konfigurierte Quelle wird still uebersprungen.

- [ ] Env-Variablen als Coolify-Secrets setzen (NICHT ins Repo committen):
  ```
  API_BASE=https://aip.aero
  API_KEY=<CRON_SECRET>
  CLOUDFLARE_ACCOUNT_ID=<Schritt 3>
  CLOUDFLARE_ANALYTICS_TOKEN=<Schritt 3>
  CLOUDFLARE_ZONE_ID=<Schritt 3, fuer Traffic>
  CLOUDFLARE_D1_DATABASE_ID=2600ff55-5ffb-442e-9d85-acf5b99dd8ad
  COOLIFY_API_URL=http://localhost:8000
  COOLIFY_API_TOKEN=<Schritt 4>
  GITHUB_TOKEN=<Schritt 5>
  GITHUB_REPO=alexanderdross/aipaero
  SENTRY_AUTH_TOKEN=<Schritt 6, optional>
  SENTRY_ORG=<optional>
  SENTRY_PROJECT=<optional>
  ```
- [ ] Dry-Run testen (sammelt + loggt, publiziert NICHT):
  ```bash
  cd crawlers && uv sync --frozen && uv run health_collector.py --dry-run
  # -> "server gatherer: collected N metrics", dann "--dry-run: skipping publish"
  ```
- [ ] Echter Lauf (schreibt in D1):
  ```bash
  cd crawlers && uv run health_collector.py
  # -> "published N metrics -> https://aip.aero/api/health?prune=1 (HTTP 201)"
  ```
- [ ] Als **Coolify Scheduled Task** planen (~alle 15 min), Muster wie der
  OurAirports-Importer (`docs/data-backfill-runbook.md`):
  Command `cd /app/crawlers && uv run health_collector.py`, Cron `*/15 * * * *`.

## 8. Dashboard-App in Coolify deployen (Klick fuer Klick)

Die App liegt im Repo unter `dashboard/` (eigenes `Dockerfile`, lauscht auf Port
`8055`). Wir deployen sie als Docker-App und binden den Port NUR an `127.0.0.1` -
erreichbar wird sie erst ueber den Tunnel (Schritt 9).

- [ ] **8.1 Neue Ressource anlegen:** Coolify -> dein **Project** -> Environment
  **production** -> **+ New Resource** -> **Application** ->
  **Private Repository (with GitHub App)** (oder Public Repository), Repo
  `alexanderdross/aipaero`, Branch `main`.
  (Alternativ **Dockerfile**-Quelle, falls du das Repo lokal auf der Box hast.)
- [ ] **8.2 Build-Einstellungen** (Tab *General* / *Build*):
  - **Build Pack:** `Dockerfile`
  - **Base Directory:** `/dashboard`
  - **Dockerfile Location:** `/dashboard/Dockerfile` (bzw. relativ `Dockerfile`,
    wenn Base Directory schon `/dashboard` ist)
- [ ] **8.3 Port intern + NUR localhost** (Tab *Network*):
  - **Ports Exposes:** `8055`
  - **Ports Mappings:** `127.0.0.1:8055:8055`
    (bindet den Host-Port ausschliesslich an localhost -> nicht oeffentlich)
  - **KEINE** Domain / kein FQDN eintragen (sonst wuerde Coolifys Proxy sie
    oeffentlich machen). Zugriff kommt allein ueber den Tunnel.
- [ ] **8.4 Env-Secrets** (Tab *Environment Variables*), als **Secret** markiert:
  ```
  HEALTH_API_BASE=https://aip.aero
  HEALTH_API_KEY=<CRON_SECRET>
  ```
- [ ] **8.5 Deploy** klicken; Build-Log abwarten (Status *running:healthy*).
- [ ] **8.6 Auf der Box pruefen:**
  ```bash
  curl -s http://127.0.0.1:8055/healthz   # -> {"ok":true}
  ```

## 9. Cloudflare Tunnel + Access (Subdomain, Klick fuer Klick)

Wir betreiben `cloudflared` als **systemd-Service** auf der Box (laeuft dauerhaft,
startet nach Reboot automatisch). Alternative als Coolify-App siehe 9.7.

- [ ] **9.1 cloudflared installieren** (falls noch nicht; Debian/Ubuntu):
  ```bash
  curl -L https://pkg.cloudflare.com/cloudflare-main.gpg \
    | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
    https://pkg.cloudflare.com/cloudflared any main" \
    | sudo tee /etc/apt/sources.list.d/cloudflared.list
  sudo apt update && sudo apt install -y cloudflared
  ```
- [ ] **9.2 Bei Cloudflare anmelden** (oeffnet einen Browser-Link, dort die Zone
  `aip.aero` autorisieren):
  ```bash
  cloudflared tunnel login
  ```
- [ ] **9.3 Tunnel anlegen** (schreibt eine Credentials-JSON nach
  `~/.cloudflared/<TUNNEL-UUID>.json`):
  ```bash
  cloudflared tunnel create aip-health
  ```
- [ ] **9.4 DNS-Route (CNAME) anlegen:**
  ```bash
  cloudflared tunnel route dns aip-health health.aip.aero
  ```
- [ ] **9.5 Config + Credentials nach `/etc/cloudflared/` legen:**
  ```bash
  sudo mkdir -p /etc/cloudflared
  # Credentials der Box-weit verfuegbaren Stelle bekannt machen:
  sudo cp ~/.cloudflared/<TUNNEL-UUID>.json /etc/cloudflared/aip-health.json
  # Config aus der Repo-Vorlage uebernehmen und anpassen:
  sudo cp dashboard/cloudflared-config.example.yml /etc/cloudflared/config.yml
  ```
  In `/etc/cloudflared/config.yml` muss stehen (die Vorlage passt bereits):
  ```yaml
  tunnel: aip-health
  credentials-file: /etc/cloudflared/aip-health.json
  ingress:
    - hostname: health.aip.aero
      service: http://127.0.0.1:8055
    - service: http_status:404
  ```
- [ ] **9.6 Als systemd-Service installieren + starten:**
  ```bash
  sudo cloudflared service install
  sudo systemctl enable --now cloudflared
  systemctl status cloudflared        # sollte "active (running)" zeigen
  ```
- [ ] **9.7 (Alternative statt 9.6) als Coolify-App:** eine neue Docker-Image-App
  `cloudflare/cloudflared:latest`, Command
  `tunnel --config /etc/cloudflared/config.yml run`, mit `config.yml` +
  `aip-health.json` als gemountete Files/Volumes. systemd (9.6) ist einfacher.
- [ ] **9.8 Cloudflare Access davor** (macht die Subdomain nicht-oeffentlich):
  **Cloudflare Zero Trust -> Access -> Applications -> Add an application ->
  Self-hosted**:
  - **Application name:** `AIP Health`
  - **Session Duration:** z.B. `24 hours`
  - **Application domain:** Subdomain `health`, Domain `aip.aero`
  - **Next -> Add policy:** Name `owner`, **Action: Allow**, Include ->
    Selector **Emails** = deine Owner-E-Mail(s).
  - Speichern. **WICHTIG:** Erst nach dieser Policy ist die Subdomain geschuetzt -
    vorher waere sie ueber den Tunnel oeffentlich erreichbar.

## 10. Verifikation (End-to-End)

- [ ] `https://health.aip.aero` oeffnen -> Access-Login -> Dashboard mit Kacheln.
  Die Server-Kachel zeigt echte RAM/Disk/Load-Werte nach dem ersten Collector-Lauf.
- [ ] Oben erscheint das **Status-Banner** (gruen/amber/rot je nach schlechtestem
  Status); kritische Zeilen sind rot hervorgehoben.
- [ ] Ohne Login (Inkognito / fremde E-Mail) -> Access blockt -> kein Zugriff.
- [ ] Nach ~15-30 min: mehrere Sample-Zeitpunkte in der DB - die **Sparklines**
  zeigen einen Verlauf (`GET /api/health?category=server` liefert mehrere Zeilen).
- [ ] Collector-Log in Coolify zeigt `HTTP 201` und keine Dauerfehler
  (nicht konfigurierte Quellen loggen "skipping" - das ist ok).
- [ ] (Sentry) Nach dem Setzen von `SENTRY_DSN`: einen Test-Fehler ausloesen und
  pruefen, dass er im Sentry-Projekt und in der Issues-Kachel erscheint.

---

## Code-Stand: KOMPLETT (alles in `main`)

| Baustein | Ort |
| --- | --- |
| D1-Tabelle + Migration `0012` (Prod aktiv) | `src/server/db/schema.ts`, `drizzle/0012_*` |
| Ingest + Read `/api/health` (Bearer, Prune 90 d) | `src/app/api/health/route.ts` |
| Collector + Gatherer (server/cloudflare/coolify/github/sentry) | `crawlers/health_collector.py`, `crawlers/health/` |
| Cloudflare-GraphQL (Workers/Traffic/Vitals/D1) + D1-REST-Groesse | `crawlers/health/cloudflare.py` (+ `cloudflare_parse.py`) |
| Coolify App-Health **+ per-Server CPU/RAM/Disk** | `crawlers/health/coolify.py` (+ `coolify_parse.py`) |
| Crawler-Selbstreport (ok/fail/count/pdf/Dauer pro Land) | `crawlers/output_handler.py`, `crawlers/main.py` |
| Sentry server-seitig (Worker) | `src/lib/sentry.ts` (in den API-Routen) |
| Client-Fehler-Beacon (Browser -> Sentry, First-Party) | `src/components/client-error-reporter.tsx`, `src/app/api/client-error/route.ts` |
| Dashboard: Kacheln + **Sparklines** + **Status-Banner/Alerting** | `dashboard/app.py` |
| Tunnel-/Deploy-Vorlagen | `dashboard/Dockerfile`, `dashboard/cloudflared-config.example.yml` |

Kuenftige, optionale Ausbauten (kein offener Auftrag): client-seitiges Sentry-
**Tracing** (braeuchte CSP `connect-src`), aktives Alerting/Benachrichtigung bei
`crit` (heute nur visuell), tiefere Cloudflare-GraphQL-Felder nach Live-Abgleich.
