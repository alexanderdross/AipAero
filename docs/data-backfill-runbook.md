# Runbook: Backfilling airport data (facts, location, map, nearby, weather)

Most facts on a detail page are gated on the field having **coordinates**:
postal address (OpenStreetMap), the map marker + "nearby airfields", and the
nearest-station weather fallback all key off them. As of the AWC/NOAA source
(below), small airfields like **EDFY Elz** already get coordinates / elevation /
runways / frequencies **out of the box, with no setup at all** - so the facts
card, the crosswind box and the per-field weather work on a bare deploy. This
runbook adds the two *optional* sources on top: OurAirports (bulk, powers the
airport-list map + town/website) and OpenAIP (fuel / PPR / hours / circuit).

---

## The three data sources

| Source | Coverage | Cost / effort | Licence |
| --- | --- | --- | --- |
| **AWC / NOAA** (`airport` endpoint, per-ICAO at request time) | any ICAO with an entry (coords, elevation, runways, frequencies) | **none - always on, no key, no importer** | US Gov public domain |
| **OurAirports importer** (bulk → D1 `airport_facts`) | ~all airfields of the 12 countries, cached | run `import_ourairports.py` once + weekly | CC0 (public domain) |
| **OpenAIP** (per-ICAO, at request time) | any looked-up ICAO | set `OPENAIP_API_KEY` secret | CC BY-NC-SA (**non-commercial**) |

The website already **combines** all three: `getAirportFacts(icao)` merges them
per field - shared physical facts (coordinates / elevation / runways /
frequencies) take the first non-empty of **OpenAIP → OurAirports → AWC**, while
unique fields go to their only source (fuel / PPR / hours → OpenAIP; town /
website → OurAirports). AWC is the always-on floor, so nothing below is required
for a working card - it only *adds* coverage. Recommendation: **run the
OurAirports importer** to light up the airport-list map + town/website; add an
OpenAIP key later only if you want the extra fields and have cleared the
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

**Apply the DB migration first.** The facts table gained columns for the
persisted address + OpenAIP enrichment (street / postcode / phone / fuel /
opening_hours / ppr / aerodrome_type / restaurant / customs). Apply pending
migrations to the remote D1 before (re)running the importer:

```bash
wrangler d1 migrations apply DB --remote
```

### A.2b - Persist the postal address into D1 (optional, `GEOCODE=1`)

By default the website reverse-geocodes the address **live** (OpenStreetMap /
Nominatim) on the first request per field, then caches it 30 days. To store it in
D1 instead - so it is a fast DB read and always in the SSR HTML + Airport JSON-LD
- run the importer with `GEOCODE=1`. It reverse-geocodes every field (street /
postcode / phone) at **max 1 request/second** (Nominatim policy), so a full run
takes ~30-60 min.

**Easiest path:** GitHub → Actions → *Airport facts import* → *Run workflow* →
check the **geocode** input. Locally / manually instead:

```bash
API_BASE=https://aip.aero API_KEY="<CRON_SECRET>" GEOCODE=1 uv run python import_ourairports.py
```

Without `GEOCODE=1` the address columns stay null and the live geocode fallback
fills them at request time (unchanged behaviour). Re-running WITHOUT geocode
does **not** erase previously persisted addresses or OpenAIP enrichment: the
upsert preserves existing enrichment columns when the incoming value is null
(`COALESCE` in `MUTATIONS.upsertAirportFacts` - null means "don't know", never
a verified absence).

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

Adds the richest per-ICAO enrichment at request time - and the **only** source
of fuel / PPR / opening hours / circuit direction. Fully fail-soft: no key falls
back to OurAirports + AWC (which still cover coordinates / elevation / runways /
frequencies).

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

### B.3 - Verify

Open a detail page and confirm the extra fields (fuel, opening hours, PPR,
circuit direction) appear. The parser (`src/lib/openaip-parse.ts`) maps field
names and enums from the authoritative public v1 schema
(`api.core.openaip.net/api/schemas/response/airport/airport-schema.json`) and is
unit-tested; codes outside the documented enums are skipped rather than
mislabelled (wrong fuel / circuit data is safety-relevant). If OpenAIP ever
revises the schema, refresh the enum maps in `openaip-parse.ts` and its test.

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

## Customs overrides (AIP GEN 1.2)

OpenAIP's customs flag is community-sourced. The authoritative list of
customs / Airport-of-Entry aerodromes is each country's **AIP GEN 1.2**
("entry, transit and departure of aircraft"). Verified values live in code -
`src/lib/customs-overrides.ts` - and win over every other source at read time
(the facts merge AND the map-filter flags), same verified-only policy as the
border-crossing form links.

Adding a country's entries:

1. Fetch the national eAIP's **GEN 1.2** section via the
   `crawler-live-test.yml` workflow's **`gen12` input** (space-separated
   country codes, e.g. `DE UK`): the run resolves the current AIRAC edition
   on the runner and prints every customs-/ICAO-relevant table row of the
   section - the sandboxed agent environment has no egress to the AIP hosts.
   Countries without a recon function yet are listed in the step's `RECONS`
   map (add one modeled on `recon_uk` for eurocontrol eAIPs).
2. Note the designated customs aerodromes (including "on request" / "with
   prior notice" fields - those count as `true`; the pilot must still check
   the AIP entry for the notice period).
3. Add `ICAO: true` entries (or `false` for fields OpenAIP wrongly flags) to
   `customsOverrides` with a source comment (`// DE GEN 1.2, AIRAC 2026-07`).
4. `pnpm check` + PR as usual. No importer run needed - the override applies
   at read time; the per-country cache revalidates on the next crawler POST
   or `/api/revalidate` call.
