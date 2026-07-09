# Runbook: Backfilling airport data (facts, location, map, nearby, weather)

Small airfields (e.g. **EDFY Elz**) currently show only the Google Maps link:
no address, no coordinates, no runways/frequencies, no map marker, no
nearest-airport weather. **All of these are gated on the field having
coordinates**, and coordinates come from one of two data sources that must be
switched on. This runbook does that, step by step.

Once a field has coordinates, everything downstream lights up automatically:
postal address (OpenStreetMap), the map marker + "nearby airfields", and the
nearest-station weather fallback.

---

## The two data sources

| Source | Coverage | Cost / effort | Licence |
| --- | --- | --- | --- |
| **OurAirports importer** (bulk → D1 `airport_facts`) | ~all airfields of the 12 countries, cached | run `import_ourairports.py` once + weekly | CC0 (public domain) |
| **OpenAIP** (per-ICAO, at request time) | any looked-up ICAO | set `OPENAIP_API_KEY` secret | CC BY-NC-SA (**non-commercial**) |

The website already **combines** both: `getAirportFacts(icao)` reads the D1
`airport_facts` row (OurAirports) and, when a key is set, enriches it from
OpenAIP. Recommendation: **run the OurAirports importer as the free baseline**;
add an OpenAIP key later only if you want the extra fields and have cleared the
non-commercial licence (no AdSense).

---

## A. OurAirports importer (recommended baseline)

Runs on the **crawler host in Coolify** (same place the country crawlers run) -
NOT on the Cloudflare Worker. It downloads the public-domain OurAirports CSVs,
filters them to the 12 countries, and POSTs per-ICAO facts to
`POST https://aip.aero/api/airport-facts` (Bearer `CRON_SECRET`).

### A.1 - Make sure the crawler app has the latest code

The importer must be the merged version (it also sends `municipality` +
`home_link`). If your Coolify crawler app auto-deploys on push to `main`, it is
already current. If not, open the crawler app in Coolify and click **Redeploy**
(or `git pull` inside the container).

### A.2 - Run it once

Open the **Terminal** of the crawler app in Coolify (the container already has
`uv` and the crawlers' `.env` with `API_ENDPOINT` + `API_KEY`) and run, in the
crawler directory:

```bash
uv run python import_ourairports.py
```

Expected output (a few thousand rows):

```
Built 3xxx airport-facts rows; posting to https://aip.aero/api/airport-facts
  posted 100/3xxx
  ...
Done.
```

If the `.env` is not auto-loaded in that shell, pass the values explicitly
(the `CRON_SECRET` is under the crawler app's Environment Variables in Coolify -
the same value the crawlers use as `API_KEY`):

```bash
API_BASE=https://aip.aero API_KEY="<CRON_SECRET>" uv run python import_ourairports.py
```

### A.3 - Verify

Open a small field that had no data before, e.g.:

```
https://aip.aero/de/vfr/?EDFY
```

The **Standort** box should now show the address + coordinates, the
**Flugplatzdaten** box the elevation/runways/frequencies, and (once the field's
own weather is absent) the **nearest-airport** weather note should appear. On the
country's charts list (`Flughafen Liste`), the map now plots the fields.

If you have `wrangler` + the Cloudflare tokens locally you can also check the row
count directly:

```bash
wrangler d1 execute DB --remote \
  --command "SELECT count(*) FROM aip_aero_v4_airport_facts"
```

### A.4 - Schedule it weekly (as a Coolify Scheduled Task)

Facts change rarely, so a weekly refresh is plenty. Add a **Scheduled Task** to
the crawler app in Coolify - the same mechanism the crawlers use, **not**
host-systemd:

- **Command:** `uv run python import_ourairports.py`
- **Cron:** `30 3 * * 0` (Sunday 03:30)

> The repo ships `crawlers/aip-facts-import.service` / `.timer` for a classic
> host-systemd setup; those do **not** fit the Coolify infra - ignore them and
> use a Coolify Scheduled Task instead.

---

## B. OpenAIP key (optional enrichment)

Adds per-ICAO enrichment at request time (coordinates for fields not in
OurAirports, plus fuel / PPR / opening hours where OpenAIP has them). Fully
fail-soft: no key = OurAirports-only.

### B.1 - Create the key

1. Go to **https://accounts.openaip.net** and register (free); confirm the email.
2. Log in, open your **profile → API keys**, and **generate an API key**. Copy it.

### B.2 - Set it on the Worker

```bash
wrangler secret put OPENAIP_API_KEY
# paste the key when prompted
```

For local `pnpm preview`, also add it to `.dev.vars`:

```
OPENAIP_API_KEY=your-key-here
```

### B.3 - Verify + validate the enums

Open a detail page and confirm the extra fields appear. Then **validate the
best-effort enum mappings against a real response** - `src/lib/openaip.ts` maps
fuel-type codes and PPR conservatively (it skips unrecognized numeric enums
rather than mislabel, since wrong fuel data is safety-relevant). If fuel or PPR
look off, capture one response and adjust `FUEL_LABEL` / `parsePpr`.

> Licence reminder: OpenAIP is **CC BY-NC-SA (non-commercial)**. Clear this
> before running ads on the site.

---

## Notes

- **Migrations** (`airport_facts` + its columns, `crawl_meta`) are applied
  automatically by the CD workflow (`wrangler d1 migrations apply DB --remote`)
  on push to `main`. You do not run them by hand.
- The per-country **crawl timestamp** on the charts list fills in as the country
  crawlers POST (each POST stamps `aip_aero_v4_crawl_meta`), independent of this
  importer.
- Everything here is fail-soft: until a source is switched on, the affected
  boxes simply render nothing - the site keeps working.
