# Health-Dashboard - Setup-Anleitung (Owner)

Schritt-fuer-Schritt-Checkliste, um das Health-Dashboard aus dem Grundgeruest
live zu bringen. Konzept + Architektur: `docs/health-dashboard-concept.md`.

Reihenfolge einhalten: **1 (DB) -> 2 (Deploy) -> 3-6 (Token) -> 7 (Collector) ->
8-9 (Tunnel+Access) -> 10 (Verifikation).** Ohne Schritt 1 500ern die Reads;
ohne 8-9 waere das Dashboard oeffentlich.

Legende: [ ] = offen, `code` = ausfuehren/eintragen.

---

## 1. Datenbank-Migration (Migrations-Hazard beachten!)

Die neue Tabelle `aip_aero_v4_health_metrics` kommt mit Migration `0012`. Nur
`cd.yml` (push-to-`main`) wendet Migrationen auf Remote-D1 an; der zweite
Cloudflare-Git-Integration-Deploy tut das NICHT. Deshalb VOR dem Merge einmal
manuell anlegen, damit kein Deploy neuen Code gegen das alte Schema faehrt.

- [ ] Migration remote anwenden (aus dem Repo-Root, mit `CLOUDFLARE_*`-Tokens):
  ```bash
  wrangler d1 migrations apply DB --remote
  ```
  ODER manuell im D1-Konsolenfenster den Inhalt von
  `drizzle/0012_dazzling_crystal.sql` ausfuehren und danach den Migrations-Eintrag
  setzen, damit der CD-Apply sie ueberspringt:
  ```sql
  INSERT INTO d1_migrations (name, applied_at)
  VALUES ('0012_dazzling_crystal.sql', datetime('now'));
  ```
- [ ] Pruefen: `wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE name='aip_aero_v4_health_metrics';"`

## 2. Merge + Deploy

- [ ] PR mergen (nach 1). Der `cd.yml`-Deploy baut + deployt den Worker inkl.
  `/api/health`.
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

- [ ] Dashboard -> My Profile -> API Tokens -> Create Token (Custom):
  - Permissions: **Account > Account Analytics > Read**,
    **Account > D1 > Read**, **Zone > Analytics > Read** (Zone = aip.aero).
  - Token kopieren -> spaeter `CLOUDFLARE_ANALYTICS_TOKEN` (Schritt 7).
- [ ] Account-ID + Zone-ID notieren (Dashboard-Uebersicht) und die D1-Database-ID
  (aus `wrangler.jsonc`, `DB` -> `2600ff55-...`).

## 4. Coolify API-Token

- [ ] In Coolify -> Keys & Tokens -> API Tokens -> neuen Token erzeugen (read).
- [ ] Coolify-API-URL notieren (typisch `http://localhost:8000`, da der Collector
  auf derselben Box laeuft). -> `COOLIFY_API_URL` / `COOLIFY_API_TOKEN`.

## 5. GitHub-Token

- [ ] Fine-grained PAT fuer `alexanderdross/aipaero` mit **Contents: Read** +
  **Actions: Read** + **Issues: Read** (oder klassischer PAT mit `repo` +
  `read:org`). -> `GITHUB_TOKEN`.

## 6. Sentry (optional)

Die server-seitige Fehlererfassung im Worker ist **schon gebaut**
(`src/lib/sentry.ts`, `captureServerError` in den API-Routen - ein direktes
Envelope an die Sentry-Ingest-API, kein SDK, keine CSP-Aenderung). Sie ist
inert, bis das DSN gesetzt ist. Schritte:

- [ ] Sentry-Projekt anlegen; `SENTRY_ORG` + `SENTRY_PROJECT` notieren.
- [ ] **DSN als Worker-Secret** setzen (aktiviert die Fehlererfassung):
  `wrangler secret put SENTRY_DSN`. Optional `SENTRY_ENVIRONMENT` als `var`.
- [ ] Auth-Token (Settings -> Auth Tokens, Scope `project:read`, `event:read`)
  -> `SENTRY_AUTH_TOKEN` fuer den Collector (`sentry.py` liest die Issue-Counts).

## 7. Collector auf der Box einrichten

Der Collector lebt im Repo (`crawlers/health_collector.py`) und laeuft auf der
Coolify/netcup-Box (dort, wo schon die Crawler laufen).

- [ ] Env-Variablen als Coolify-Secrets setzen (NICHT ins Repo):
  ```
  API_BASE=https://aip.aero
  API_KEY=<CRON_SECRET>
  CLOUDFLARE_ACCOUNT_ID=<...>
  CLOUDFLARE_ANALYTICS_TOKEN=<Schritt 3>
  CLOUDFLARE_D1_DATABASE_ID=2600ff55-5ffb-442e-9d85-acf5b99dd8ad
  COOLIFY_API_URL=http://localhost:8000
  COOLIFY_API_TOKEN=<Schritt 4>
  GITHUB_TOKEN=<Schritt 5>
  GITHUB_REPO=alexanderdross/aipaero
  SENTRY_AUTH_TOKEN=<Schritt 6, optional>
  SENTRY_ORG=<optional>
  SENTRY_PROJECT=<optional>
  ```
- [ ] Dry-Run testen (kein Publish):
  ```bash
  cd crawlers && uv sync --frozen && uv run health_collector.py --dry-run
  # -> "server gatherer: collected N metrics", danach "--dry-run: skipping publish"
  ```
- [ ] Echter Lauf (schreibt in D1):
  ```bash
  cd crawlers && uv run health_collector.py
  # -> "published N metrics -> https://aip.aero/api/health?prune=1 (HTTP 201)"
  ```
- [ ] Als **Coolify Scheduled Task** planen (~alle 15 min), Muster wie der
  OurAirports-Importer in `docs/data-backfill-runbook.md`:
  Command `cd /app/crawlers && uv run health_collector.py`, Cron `*/15 * * * *`.

## 8. Dashboard-App in Coolify deployen

- [ ] Neue Coolify-App aus dem Ordner `dashboard/` (Dockerfile-Build).
- [ ] Env-Secrets der App:
  ```
  HEALTH_API_BASE=https://aip.aero
  HEALTH_API_KEY=<CRON_SECRET>
  ```
- [ ] Container-Port `8055` NUR an `127.0.0.1` binden - kein oeffentlicher Port.
  Erreichbarkeit kommt ausschliesslich ueber den Tunnel (Schritt 9).
- [ ] Lokal auf der Box pruefen: `curl -s http://127.0.0.1:8055/healthz` -> `{"ok":true}`.

## 9. Cloudflare Tunnel + Access (Subdomain)

- [ ] `cloudflared` auf der Box installieren (falls noch nicht) und einloggen:
  ```bash
  cloudflared tunnel login
  cloudflared tunnel create aip-health
  cloudflared tunnel route dns aip-health health.aip.aero
  ```
- [ ] Config aus `dashboard/cloudflared-config.example.yml` uebernehmen (Ingress
  `health.aip.aero -> http://127.0.0.1:8055`) und Tunnel als Service/Coolify-App
  starten: `cloudflared tunnel run aip-health`.
- [ ] **Cloudflare Zero Trust -> Access -> Applications -> Add** (Self-hosted):
  - Application domain: `health.aip.aero`
  - Policy: **Allow**, Selector **Emails** = deine Owner-E-Mail.
  - Session-Dauer nach Geschmack (z.B. 24h).
  - WICHTIG: erst NACH dieser Policy ist die Subdomain live - vorher waere sie
    ueber den Tunnel oeffentlich.

## 10. Verifikation (End-to-End)

- [ ] `https://health.aip.aero` oeffnen -> Access-Login -> Dashboard mit Kacheln
  (Server-Kachel zeigt echte RAM/Disk/Load-Werte nach dem ersten Collector-Lauf).
- [ ] Ohne Login (z.B. Inkognito, fremde E-Mail) -> Access blockt -> kein Zugriff.
- [ ] Nach ~15-30 min: mehrere Sample-Zeitpunkte in der DB
  (`GET /api/health?category=server` liefert mehrere Zeilen).
- [ ] Collector-Log in Coolify zeigt `HTTP 201` und keine Dauerfehler
  (unkonfigurierte Quellen loggen "skipping", das ist ok).

---

## Code-Stand (alles GEBAUT + gemergt)

- Cloudflare-GraphQL-Gatherer (Workers/Traffic/Vitals/D1) in
  `crawlers/health/cloudflare.py` (+ `cloudflare_parse.py`). GraphQL-Feldnamen
  ggf. am Live-Account verifizieren (der Parser ist defensiv - unbekannte Felder
  werden still uebersprungen).
- Coolify-Gatherer (App-/Resource-Health) in `crawlers/health/coolify.py`.
- Crawler-Selbstreport (ok/fail/count/pdf/Dauer pro Land) in
  `crawlers/output_handler.py` + `main.py`.
- Sentry server-seitig im Worker (`src/lib/sentry.ts`) - braucht nur das
  DSN-Secret (Schritt 6).
- Dashboard mit Zeitreihen-Sparklines (`dashboard/app.py`).

Offen (kuenftige, optionale PRs): Coolify per-Server CPU/RAM, Client-seitiges
Sentry + Tracing (braeuchte CSP `connect-src`), Alerting bei `crit`.
