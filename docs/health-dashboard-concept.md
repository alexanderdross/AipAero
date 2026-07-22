# Health-Dashboard - Konzept

Owner-Auftrag 22.07.2026: ein internes Health-Dashboard, das den Gesamtzustand
des Systems an EINER Stelle zeigt - Cloudflare (Workers-Health, Web Vitals,
Traffic), erfolgreiche/fehlerhafte Crawls, allgemeine Issues, Coolify-Stats,
Server-Auslastung (RAM/Disk/Load) und Datenbank-Health. Alle Werte landen in
einer eigenen Analytics-Tabelle in D1; das Dashboard ist NUR ueber einen
Cloudflare Tunnel auf einer Subdomain (`health.aip.aero`) erreichbar.

## Kernspannung (warum die Architektur so aussieht)

Die Website laeuft auf **Cloudflare Workers** - serverless, keine Box zum
Tunneln, kein psutil, keine Coolify-Sicht. Drei geforderte Quellen existieren
aber NUR auf der **netcup/Coolify-Box** (die schon den self-hosted Runner + den
Crawler-Container traegt): Server-RAM/-Disk/-Load und die Coolify-Stats. Ein
Cloudflare Tunnel ist genau das Mittel, eine box-lokale App auf einer Subdomain
zu veroeffentlichen. Deshalb ist das Dashboard KEINE Worker-Route, sondern eine
eigene kleine App auf der Box - dort, wo die Box-Metriken ohnehin anfallen.

## Architektur

```
                    Coolify / netcup-Box (privat)
  +-----------------------------------------------------------+
  |  health_collector.py  (Coolify Scheduled Task, ~alle 15m) |
  |    server.py   psutil: RAM/Disk/Load/CPU     [lokal]      |
  |    cloudflare.py  GraphQL Analytics + D1 REST            |
  |    coolify.py     Coolify-API                 [localhost] |
  |    github.py      offene Issues + failed Runs           |
  |    sentry.py      unresolved Issues                     |
  |         |  POST /api/health  (Bearer CRON_SECRET)         |
  |         v                                                  |
  |  dashboard/ (FastAPI)  -- liest GET /api/health --------+ |
  +---------|----------------------------------------------|--+
            | cloudflared Tunnel (health.aip.aero)         |
            v                                               v
     Cloudflare Access (Owner-E-Mail)          Cloudflare Worker (aip.aero)
            |                                     /api/health  (POST/GET)
            v                                     MUTATIONS.insertHealthMetrics
     Browser (Owner)                                      |
                                                          v
                                             D1: aip_aero_v4_health_metrics
```

Zusaetzlich melden die **Crawler selbst** (Phase 2) ihr Ergebnis pro Land am Ende
jedes Publish an denselben Endpoint - der Crawler kennt sein Ergebnis am
praezisesten (ok/fail, Count, PDF-Coverage, Dauer, Drop-Guard-Anomalie).

**Web Vitals** kommen AGGREGIERT vom Collector aus der Cloudflare-Web-Analytics-
GraphQL (p75), NICHT als per-Beacon-D1-Write. Der bestehende `/api/vitals`-Beacon
(`src/app/api/vitals/route.ts`) bleibt unveraendert (loggt weiter in die Worker-
Observability). Grund: ein D1-Write pro Beacon waere Write-Amplification auf dem
Request-Pfad - genau das Muster, das die CLAUDE.md-Guardrails (Error 1102)
vermeiden wollen.

## Datenmodell - `aip_aero_v4_health_metrics`

Generische, append-only Zeitreihe (deckt alle Kategorien ab, zukunftssicher -
eine neue Quelle braucht KEINE Migration, sie POSTet einfach neue (category,
metric)-Paare). In `src/server/db/schema.ts` via `createTable("health_metrics")`:

| Spalte | Typ | Zweck |
| --- | --- | --- |
| `id` | integer PK autoincrement | |
| `recorded_at` | integer notNull | Sample-Zeit, unix seconds (Box-Uhr = UTC) |
| `category` | text notNull | `cloudflare` \| `server` \| `coolify` \| `database` \| `crawl` \| `issues` \| `vitals` |
| `metric` | text notNull | z.B. `ram_used_pct`, `disk_used_pct`, `load1`, `d1_storage_bytes`, `worker_requests`, `lcp_p75`, `open_issues`, `ci_failed` |
| `value` | real | numerischer Wert (nullable) |
| `unit` | text | `ms` \| `pct` \| `bytes` \| `count` \| `ratio` \| `s` (nullable) |
| `scope` | text | optionale Dimension: Land / Pfad / Worker / Service / Quelle |
| `status` | text | `ok` \| `warn` \| `crit` fuer Health-/Issue-Zeilen |
| `meta` | text | JSON fuer Extra-Detail |

Indizes: `(category, metric)`, `recorded_at`, `scope`. Migration:
`drizzle/0012_dazzling_crystal.sql`. **Retention:** append-only; der Collector
ruft am Ende jedes Laufs den Prune (`?prune=1` -> `MUTATIONS.pruneHealthMetrics`,
Standard 90 Tage) - keine separate Cron noetig.

**Migrations-Hazard beachten** (CLAUDE.md, Deployment): der zweite Git-
Integration-Deploy wendet KEINE Migrationen an. Nur `cd.yml` (push-to-`main`)
macht `wrangler d1 migrations apply DB --remote`. Fuer diesen Merge deshalb die
Migration `0012` vorab einmal manuell auf Remote-D1 anlegen UND in `d1_migrations`
eintragen (wie bei `0007`), damit der CD-Apply sie ueberspringt.

## API - `/api/health` (`src/app/api/health/route.ts`)

- **POST** (Bearer `CRON_SECRET`): validiert den Batch mit
  `healthMetricsApiInsertSchema` (drizzle-zod, camelCase-Keys wie der Airports-
  Ingest `pdfUrl`), chunked-insert via `MUTATIONS.insertHealthMetrics` (D1
  100-Param-Cap -> 12 Zeilen/Chunk), optional `?prune=1` fuer die Retention. 201.
- **GET** (Bearer): Filter `since` / `category` / `metric` / `limit` ->
  `QUERIES.healthMetrics` (UNCACHED, fail-soft `[]`) -> `{ count, metrics }`.
  Vom Dashboard serverseitig gelesen; der Browser sieht das Secret nie.

`QUERIES.healthMetrics` ist bewusst uncached und traegt KEINE Cache-Tags - nie
auf einem oeffentlichen Request-Pfad (gleiche Begruendung wie die As-you-type-
Suche).

## Collector (Box) - `crawlers/health_collector.py` + `crawlers/health/`

- Eigene `HealthSettings` (`crawlers/health/settings.py`), ENTKOPPELT von der
  Crawler-`Settings`: alle Felder optional, damit ein Lauf ohne CF/Coolify/
  GitHub/Sentry-Credentials trotzdem die Host-Metriken sammelt. Ohne `API_KEY`
  laeuft der Collector im DRY-RUN (sammelt + loggt, POSTet nicht).
- Jeder Gatherer ist voll **fail-soft** (tote/unkonfigurierte Quelle -> `[]`,
  nie ein Crash) - dieselbe Isolation wie die per-Land-Crawls in `main.py`:
  - `server.py` - **fertig**: psutil RAM/Swap/Disk/Load/CPU/Uptime (13 Metriken).
  - `cloudflare.py` - **fertig**: GraphQL Analytics (Workers requests/errors/
    CPU-pXX, Zone-Traffic, RUM Web Vitals p75, D1-Analytics) + D1-Groesse via
    REST. Reine Mapper in `cloudflare_parse.py` (unit-getestet,
    `tests/test_health_cloudflare_parse.py`), voll defensiv (Schema-Drift ->
    weniger Metriken, nie ein Crash).
  - `coolify.py` - Resource-up/down via `/api/v1/resources` **minimal**; Phase 2:
    per-Server CPU/RAM.
  - `github.py` - offene Issues + letzter Run-Status je Workflow (crawl/facts-
    import/cd/ci) **minimal-fertig**.
  - `sentry.py` - unresolved Issues **minimal-fertig** (setzt Sentry-Anbindung
    der Worker-App voraus, Phase 2).
- Publish: ein `httpx`-POST an `{API_BASE}/api/health?prune=1`.
- Neue Dependency: `psutil` (pure wheel, lazy import). `uv lock` aktualisiert.

## Dashboard (Box) - `dashboard/`

Kleine **FastAPI**-App (eigenes Mini-Projekt, `requirements.txt` + `Dockerfile`).
Haelt `HEALTH_API_KEY` (= `CRON_SECRET`) serverseitig, liest `GET /api/health`
(letzte 24 h), gruppiert je Kategorie den letzten Wert pro Metrik + Ampel, rendert
Kacheln (Cloudflare / Server / Coolify / Datenbank / Crawls / Issues / Vitals),
Auto-Refresh 60 s. `GET /api/data` fuer JSON. Intern (`noindex`), NICHT lokalisiert
(keine neuen i18n-Keys, `check:countries` bleibt unberuehrt). Phase 2: Zeitreihen-
Charts, Schwellwert-Ampeln.

## Env / Secrets

Worker-Seite: **keine neuen Pflicht-Vars** - der Ingest nutzt das bestehende
`CRON_SECRET`. (Sentry-DSN kommt erst mit der Phase-2-Worker-Anbindung dazu.)

Box-Seite (Collector, in Coolify als Env-Secrets, NICHT im Repo):

| Var | Zweck |
| --- | --- |
| `API_BASE` | Website-Basis (Default `https://aip.aero`) |
| `API_KEY` | = `CRON_SECRET` (Bearer fuer `/api/health`) |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_ANALYTICS_TOKEN` | CF Analytics + D1 read (read-only Token) |
| `CLOUDFLARE_D1_DATABASE_ID` | fuer die D1-Groessen-REST-Abfrage |
| `COOLIFY_API_URL` / `COOLIFY_API_TOKEN` | Coolify-API (localhost) |
| `GITHUB_TOKEN` / `GITHUB_REPO` | Issues + Run-Status (`repo`+`actions:read`) |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Sentry-Issues |

Dashboard-App: `HEALTH_API_BASE`, `HEALTH_API_KEY` (= `CRON_SECRET`).

## Owner-Schritte

1. **Migration 0012** vorab auf Remote-D1 anlegen + in `d1_migrations` eintragen
   (Migrations-Hazard oben), oder sicherstellen, dass nur `cd.yml` deployt.
2. **Cloudflare API-Token** (read-only, Analytics + D1 read) erzeugen ->
   `CLOUDFLARE_ANALYTICS_TOKEN`.
3. **Coolify API-Token** -> `COOLIFY_API_TOKEN` (+ `COOLIFY_API_URL`).
4. **GitHub PAT** (`repo` + `actions:read`) -> `GITHUB_TOKEN`.
5. **Sentry**: Projekt anlegen, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`;
   danach (Phase 2) `@sentry/cloudflare` in die Worker-App + Ingest-Host in die
   CSP `connect-src`.
6. **cloudflared Tunnel**: `cloudflared tunnel create aip-health`, Ingress
   `health.aip.aero -> http://127.0.0.1:8055` (siehe
   `dashboard/cloudflared-config.example.yml`), DNS-CNAME anlegen.
7. **Cloudflare Access**: Application auf `health.aip.aero`, Policy = Owner-E-Mail
   (Allow) - erst danach ist die Subdomain live (und NICHT oeffentlich).
8. **Collector-Scheduling**: Coolify Scheduled Task (~alle 15 min)
   `uv run health_collector.py` (Muster: OurAirports-Importer,
   `docs/data-backfill-runbook.md`).

## Phasen

| Phase | Inhalt | Status |
| --- | --- | --- |
| 0 | Konzept + Grundgeruest: `health_metrics`-Tabelle + Migration, `/api/health` (POST/GET), Collector-Skelett (server.py fertig, uebrige fail-soft), Dashboard-Skelett + Tunnel-Config | **GEBAUT 22.07.2026** |
| 1 | CF-GraphQL voll (Workers/Traffic/Vitals/D1) - **GEBAUT**; Coolify per-Server offen; Owner-Setup (Token/Tunnel/Access), erster Live-Collect offen | teilweise |
| 2 | Sentry in die Worker-App (`@sentry/cloudflare` + CSP), Collector liest Sentry; Crawler-Selbstreport-Hook in `output_handler.py` | offen |
| 3 | Dashboard-Ausbau: Zeitreihen-Charts, Ampeln, Alerting bei `crit` | offen |

## Verifikation

1. `pnpm db:generate` -> `0012_*.sql`; `wrangler d1 migrations apply DB --local`.
2. `pnpm check` gruen; `pnpm test`; Crawler: `uv lock --check`, `pytest`,
   `compileall` (health-Package inkl.).
3. Ingest lokal (`pnpm preview`): `curl -X POST localhost:8788/api/health -H
   "Authorization: Bearer <CRON_SECRET>" -d '[{"recordedAt":<ts>,"category":
   "server","metric":"ram_used_pct","value":42,"unit":"pct"}]'` -> 201;
   `GET /api/health?category=server` liefert die Zeile.
4. Collector auf der Box: `uv run health_collector.py --dry-run` - `server.py`
   liefert echte RAM/Disk/Load-Werte, unkonfigurierte Quellen fail-soft
   uebersprungen (verifiziert 22.07.2026: 13 Server-Metriken).
5. Dashboard: `dashboard/` starten, `health.aip.aero` (nach Tunnel+Access) zeigt
   die Kacheln; ohne Access-Login kein Zugriff.
