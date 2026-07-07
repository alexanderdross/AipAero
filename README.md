# AIP:Aero Next.js Frontend

This repo contains the code for [https://aip.aero](https://aip.aero). It is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Hosting

The project is split across two hosts:

- **Website (`src/`) → [Vercel](https://vercel.com).** The new `aip.aero` is served from Vercel via the GitHub integration.
- **Crawlers (`crawlers/`) → [netcup](https://www.netcup.eu/) root server.** The Python scrapers stay on the existing netcup VM under systemd (`aip-crawler.service` + `aip-crawler.timer`). Serverless is the wrong runtime for scheduled, long-running scraping, so the crawlers are **not** deployed to Vercel. They reach the website over HTTP and post results to `https://aip.aero/api/airports`.

The Docker setup (`Dockerfile` / `docker-compose.yml`) is the legacy way the website used to run on the same netcup host. It's kept for local container testing only and is no longer the production path.

## Design Architecture

```mermaid
flowchart TD
 subgraph subGraph0["Next.js Application (Vercel, https://aip.aero)"]
        API["API Endpoint /api/airports"]
        Website["Website"]
        InsertAction["Server Action: Insert Airports"]
        ReadAction["Server Action: Read Airports"]
        Cache["Cache"]
        IsHit{"Cache hit?"}
  end
 subgraph subGraph1["netcup root server (systemd timer)"]
        Crawlers["Airport Crawlers (Python)"]
  end
    Crawlers -- POST data --> API
    API -- calls --> InsertAction
    InsertAction -- inserts airports --> MySQL[("MySQL Database")]
    InsertAction -- clears --> Cache
    Website -- uses --> ReadAction
    ReadAction -- queries airports --> Cache
    Cache --> IsHit
    IsHit -- No --> MySQL
```

## Used Libraries

- [Next.js](https://nextjs.org) (App Router, React 19) on [Cloudflare Workers](https://workers.cloudflare.com/) via [OpenNext](https://opennext.js.org/cloudflare)
- [Drizzle](https://orm.drizzle.team) ORM with [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- [Tailwind CSS](https://tailwindcss.com)
- [next-intl](https://next-intl-docs.vercel.app/) for i18n

## Local Development

```bash
pnpm install
cp .env.example .env        # fill in CRON_SECRET, ADSENSE_ID
cp .dev.vars.example .dev.vars   # secrets/vars for `pnpm preview` (Workers)
pnpm dev                    # Next.js dev server with Turbopack
```

Run the app on the Workers runtime locally (miniflare + local D1/KV):

```bash
wrangler d1 migrations apply DB --local   # create the schema in the local D1
pnpm preview                              # build with OpenNext + serve the Worker
```

Useful scripts: `pnpm check` (lint + typecheck), `pnpm db:generate`, `pnpm db:studio`, `pnpm format:write`, `pnpm cf-build`, `pnpm deploy`.

## Deployment

### Cloudflare Workers (current)

The website runs on Cloudflare Workers via the OpenNext adapter (`wrangler.jsonc` + `open-next.config.ts`).

One-time setup:

```bash
wrangler d1 create aip-aero                 # app DB       -> binding DB
wrangler d1 create aip-aero-tag-cache       # tag cache    -> NEXT_TAG_CACHE_D1
wrangler kv namespace create NEXT_INC_CACHE_KV   # incr cache -> NEXT_INC_CACHE_KV
# paste the returned IDs into wrangler.jsonc (they ship as REPLACE_WITH_* placeholders)
wrangler secret put CRON_SECRET
wrangler secret put ADSENSE_ID
wrangler d1 migrations apply DB --remote     # apply the schema to production D1
```

Then deploy with `pnpm deploy`. The crawlers repopulate the data by POSTing to `/api/airports`.

### Docker (legacy)

```bash
docker compose up --build -d
```

The container exposes port `3000` internally (mapped to `127.0.0.1:8080` by `docker-compose.yml`) and used to sit behind a reverse proxy on the netcup host. This path is no longer used in production — it remains only for local container testing.

### Crawlers (netcup)

The Python crawlers under `crawlers/` run on the netcup root server, scheduled by `aip-crawler.timer`. They use `httpx` + `BeautifulSoup` for static AIP sites (AT, NL, UK, FR are on this path; DE is the last Selenium holdout). See `crawlers/README.md` for the per-country status, the `Airport` schema, and how to add a new country.

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available)

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — feedback and contributions are welcome!
