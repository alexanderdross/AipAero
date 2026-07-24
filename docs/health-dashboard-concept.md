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

Zusaetzlich melden die **Crawler selbst** ihr Ergebnis pro Land am Ende jedes
Runs an denselben Endpoint - der Crawler kennt sein Ergebnis am praezisesten
(ok/fail, Count, PDF-Count, Dauer, Grund bei Fehlschlag). **GEBAUT**: `main.py`
sammelt pro Land einen `CrawlReport` (`crawlers/health/crawl_report.py`,
unit-getestet), `OutputHandler.write_output` liefert ihn, und am Ende POSTet
`OutputHandler.publish_crawl_health` alle Laender in EINEM Batch an `/api/health`
(category `crawl`, scope = Landcode). Reuse des `CRON_SECRET`-Bearers, voll
fail-soft (ein Fehler im Health-Report beruehrt weder Crawl noch Airport-Publish).

**Web Vitals** werden jetzt ZUSAETZLICH als First-Party-RUM pro Seitenaufruf in
einer EIGENEN `analytics`-Tabelle persistiert (Owner-Entscheid 24.07.2026, loest
die fruehere "nur aggregiert"-Regel ab). Der `/api/vitals`-Beacon
(`src/app/api/vitals/route.ts`) sanitisiert weiter (`sanitizeVitals`), loggt in die
Worker-Observability UND schreibt eine Zeile via `MUTATIONS.insertAnalytics` -
aber **ausserhalb des kritischen Pfads** (`ctx.waitUntil`, nach dem 204) und voll
fail-soft, plus 90-Tage-Retention (`GET /api/vitals?prune=1`). Damit ist die
alte Write-Amplification-/Error-1102-Sorge entschaerft: kein DB-Write auf dem
Response-Pfad, ein forged/oversized Beacon wird verworfen. Die aggregierte
Cloudflare-Web-Analytics-GraphQL-Quelle (p75, `category=vitals` im
`health_metrics`) bleibt als site-weite Ergaenzung; die `analytics`-Tabelle
liefert die per-URL-Feldwerte. `GET /api/vitals` (Bearer `CRON_SECRET`) liest die
juengsten Zeilen fuer die Dashboard-Vitals-Kachel. Die Tabelle traegt KEINE
Cache-Tags (nie auf einem oeffentlichen Lesepfad).

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
  - `sentry.py` - unresolved Issues **minimal-fertig**. Die Worker-Seite ist
    **GEBAUT**: `src/lib/sentry.ts` (`captureServerError`) POSTet Worker-Fehler
    als minimales Envelope direkt an die Sentry-Ingest-API (KEIN `@sentry`-SDK,
    kein Wrappen des OpenNext-`worker.js`, keine CSP-Aenderung - server-seitig),
    verdrahtet in den 500-`catch`-Bloecken der API-Routen, fail-soft via
    `ctx.waitUntil`, No-Op ohne `SENTRY_DSN`. Braucht nur noch das DSN-Secret.
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

Worker-Seite: der Ingest nutzt das bestehende `CRON_SECRET`. Zusaetzlich
optional `SENTRY_DSN` (+ `SENTRY_ENVIRONMENT`) fuer die server-seitige
Fehlererfassung (`src/lib/sentry.ts`); unset = No-Op. Set mit
`wrangler secret put SENTRY_DSN`.

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
| `ALERT_NTFY_URL` (optional) | ntfy-Topic-URL fuer Push bei `crit` (unset = kein Alerting) |

Dashboard-App: `HEALTH_API_BASE`, `HEALTH_API_KEY` (= `CRON_SECRET`).

## Owner-Schritte

1. **Migration 0012** vorab auf Remote-D1 anlegen + in `d1_migrations` eintragen
   (Migrations-Hazard oben), oder sicherstellen, dass nur `cd.yml` deployt.
2. **Cloudflare API-Token** (read-only, Analytics + D1 read) erzeugen ->
   `CLOUDFLARE_ANALYTICS_TOKEN`.
3. **Coolify API-Token** -> `COOLIFY_API_TOKEN` (+ `COOLIFY_API_URL`).
4. **GitHub PAT** (`repo` + `actions:read`) -> `GITHUB_TOKEN`.
5. **Sentry**: Projekt anlegen, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`
   fuer den Collector; `SENTRY_DSN` als Worker-Secret (`wrangler secret put
   SENTRY_DSN`) fuer die server-seitige Fehlererfassung (schon gebaut,
   `src/lib/sentry.ts`).
6. **cloudflared Tunnel**: `cloudflared tunnel create aip-health`, Ingress
   `health.aip.aero -> http://127.0.0.1:8055` (siehe
   `dashboard/cloudflared-config.example.yml`), DNS-CNAME anlegen.
7. **Cloudflare Access**: Application auf `health.aip.aero`, Policy = Owner-E-Mail
   (Allow) - erst danach ist die Subdomain live (und NICHT oeffentlich).
8. **Collector-Scheduling**: Coolify Scheduled Task (~alle 15 min)
   `uv run health_collector.py` (Muster: OurAirports-Importer,
   `docs/data-backfill-runbook.md`).

## PWA + Web Push (Offline + Benachrichtigungen)

Das Dashboard ist eine **PWA**: installierbar (z.B. auf dem Handy des Owners),
offline-fahig und es empfaengt **Web-Push-Benachrichtigungen**, sobald eine
Metrik `crit` wird - so muss niemand die Seite offen halten, um einen Alarm zu
sehen. Alles self-contained (kein CDN/Fremd-JS), passend zur Tunnel+Access-Lage.

- **Manifest + Icon + Service Worker** liefert die FastAPI-App selbst
  (`/manifest.webmanifest`, `/icon.svg`, `/sw.js`). Der SW cached die Shell
  (network-first, offline-Fallback aus dem Cache; `/api/*` wird NIE abgefangen)
  und macht aus einem eingehenden Push eine native Notification.
- **Web Push (VAPID)** ist geteilt zwischen Dashboard und Collector:
  - Das **Dashboard** kennt nur den **PUBLIC** Key (`HEALTH_VAPID_PUBLIC_KEY`),
    zeigt einen "Benachrichtigungen aktivieren"-Button und speichert die
    Browser-`PushSubscription` in `HEALTH_PUSH_SUBS_FILE`
    (`push_subscriptions.json`, dedupe per Endpoint). Ohne Public Key bleibt der
    Button verborgen (Push nicht provisioniert).
  - Der **Collector** halt den **PRIVATE** Key (`VAPID_PRIVATE_KEY`), liest
    dieselbe Subs-Datei (`PUSH_SUBS_FILE`) und schickt bei `crit`/Recovery
    denselben Alert-Text auch als verschluesselten Web Push (`pywebpush`, lazy
    importiert). Tote Subscriptions (404/410) werden aus der Datei entfernt.
    Inert ohne Private Key (ntfy feuert unabhaengig davon weiter).
- **Shared Volume**: laufen Dashboard und Collector in getrennten Containern,
  MUESSEN `HEALTH_PUSH_SUBS_FILE` (Dashboard) und `PUSH_SUBS_FILE` (Collector)
  auf denselben Pfad zeigen (ein gemeinsames Volume), sonst sieht der Collector
  die im Browser angelegten Subscriptions nicht.
- **VAPID-Keypair** einmalig erzeugen (`pip install py-vapid && vapid --gen`
  oder `pywebpush`'s Vapid-Helper): den Private Key auf den Collector, den
  Public Key aufs Dashboard. `VAPID_SUBJECT` = `mailto:info@aip.aero`.
- **HTTPS-Voraussetzung**: Web Push + Service Worker brauchen einen sicheren
  Kontext - durch den Cloudflare Tunnel (`https://health.aip.aero`) gegeben.

## Phasen

| Phase | Inhalt | Status |
| --- | --- | --- |
| 0 | Konzept + Grundgeruest: `health_metrics`-Tabelle + Migration, `/api/health` (POST/GET), Collector-Skelett (server.py fertig, uebrige fail-soft), Dashboard-Skelett + Tunnel-Config | **GEBAUT 22.07.2026** |
| 1 | CF-GraphQL voll (Workers/Traffic/Vitals/D1) - **GEBAUT**; Coolify per-Server offen; Owner-Setup (Token/Tunnel/Access), erster Live-Collect offen | teilweise |
| 2 | Crawler-Selbstreport (`crawl_report.py`) - **GEBAUT**; Sentry server-seitig im Worker (`src/lib/sentry.ts`, direktes Envelope statt SDK, keine CSP) - **GEBAUT**; Collector liest Sentry-API - **minimal-fertig** | GEBAUT |
| 3 | Alerting bei `crit` (ntfy-Push, Debounce/Cooldown, Recovery-Notiz) - **GEBAUT** (`health/alert.py`, inert ohne `ALERT_NTFY_URL`); Dashboard-Zeitreihen-Charts weiter offen | teilweise |
| 4 | Dashboard-PWA: Manifest + Icon + Service Worker (offline), Web Push bei `crit` (Dashboard haelt Public-Key + Subs-Datei, Collector sendet via `pywebpush`) - **GEBAUT** (inert ohne VAPID-Keys); Owner-Setup: VAPID-Keypair + Shared Volume | teilweise |

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
