# Health-Dashboard (interne App auf der Box)

Kleine FastAPI-App, die das AIP:Aero Health-Dashboard rendert. Sie laeuft auf der
Coolify/netcup-Box und ist **nur ueber einen Cloudflare Tunnel** auf einer
Subdomain (z.B. `health.aip.aero`) erreichbar, davor eine **Cloudflare
Access**-Policy (Owner-E-Mail). Details + Owner-Setup: `docs/health-dashboard-concept.md`.

## Was sie tut

- Liest die Kennzahlen der letzten 24 h aus der D1-Analytics-Tabelle ueber den
  Bearer-gesicherten `GET /api/health` der Website (das `CRON_SECRET` bleibt
  serverseitig in der App, der Browser sieht es nie).
- Gruppiert sie in Kacheln: Cloudflare / Server / Coolify / Datenbank / Crawls /
  Issues / Vitals, mit dem letzten Wert je Metrik + Ampel (`ok`/`warn`/`crit`).
- `GET /` rendert die HTML-Seite, `GET /api/data` liefert das JSON fuer den
  clientseitigen Refresh.
- **PWA**: installierbar + offline-faehig (`GET /manifest.webmanifest`,
  `/icon.svg`, `/sw.js` - self-contained, kein CDN). Bei gesetztem VAPID-Public-
  Key zeigt die Seite einen "Benachrichtigungen aktivieren"-Button und speichert
  die Browser-`PushSubscription` in `HEALTH_PUSH_SUBS_FILE`; der Collector sendet
  daran bei `crit` eine Web-Push-Benachrichtigung (siehe Konzept-Doc). Ohne
  Public-Key bleibt der Button verborgen.

Der Collector (`../crawlers/health_collector.py`) FUELLT die Tabelle; diese App
LIEST nur. Beide teilen sich das `CRON_SECRET`.

## Lokal starten

```bash
cd dashboard
uv run --with fastapi --with "uvicorn[standard]" --with httpx \
  uvicorn app:app --host 127.0.0.1 --port 8055
# Env: HEALTH_API_BASE (default https://aip.aero), HEALTH_API_KEY (= CRON_SECRET)
# PWA-Push (optional): HEALTH_VAPID_PUBLIC_KEY, HEALTH_PUSH_SUBS_FILE
#   (letztere = derselbe Pfad wie der Collector-PUSH_SUBS_FILE, shared volume)
```

Dann `http://127.0.0.1:8055`. In Produktion NICHT direkt exponieren - nur ueber
den cloudflared-Tunnel (siehe `cloudflared-config.example.yml`) + Access.

## Deploy (Coolify + Tunnel)

1. Als Coolify-App aus diesem Verzeichnis bauen (`Dockerfile`), Port 8055, an
   `127.0.0.1` gebunden (kein oeffentlicher Port).
2. `cloudflared` als eigener Service mit `cloudflared-config.example.yml` (Ingress
   `health.aip.aero -> http://127.0.0.1:8055`), DNS-CNAME via
   `cloudflared tunnel route dns aip-health health.aip.aero`.
3. In Cloudflare Zero Trust eine **Access Application** auf `health.aip.aero`
   anlegen, Policy = Owner-E-Mail (Allow). Erst danach ist die Subdomain live.
