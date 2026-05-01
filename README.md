# AIP:Aero Next.js Frontend

This repo contains the code for [https://aip.aero](https://aip.aero). It is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Hosting

- **Current (legacy):** self-hosted on a [netcup](https://www.netcup.eu/) root server via Docker (see `Dockerfile` / `docker-compose.yml`).
- **New target:** [Vercel](https://vercel.com). Going forward, deployments to `aip.aero` are served from Vercel's edge network. The Docker setup remains in the repo only as a fallback / for local container testing.

## Design Architecture

```mermaid
flowchart TD
 subgraph subGraph0["Next.js Application (Vercel)"]
        API["API Endpoint /api/airports"]
        Website["Website"]
        InsertAction["Server Action: Insert Airports"]
        ReadAction["Server Action: Read Airports"]
        Cache["Cache"]
        IsHit{"Cache hit?"}
  end
    Crawlers["Airport Crawlers"] -- POST data --> API
    API -- calls --> InsertAction
    InsertAction -- inserts airports --> MySQL[("MySQL Database")]
    InsertAction -- clears --> Cache
    Website -- uses --> ReadAction
    ReadAction -- queries airports --> Cache
    Cache --> IsHit
    IsHit -- No --> MySQL
```

## Used Libraries

- [Next.js](https://nextjs.org) (App Router, React 19)
- [Drizzle](https://orm.drizzle.team) ORM with MySQL
- [Tailwind CSS](https://tailwindcss.com)
- [next-intl](https://next-intl-docs.vercel.app/) for i18n
- [next-axiom](https://github.com/axiomhq/next-axiom) for logging

## Local Development

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_*, CRON_SECRET, ADSENSE_ID, AXIOM tokens
./start-database.sh    # optional: spins up a local MySQL via Docker
pnpm dev               # starts Next.js with Turbopack
```

Useful scripts: `pnpm check` (lint + typecheck), `pnpm db:push`, `pnpm db:studio`, `pnpm format:write`.

## Deployment

### Vercel (current)

Deployments happen automatically via the Vercel GitHub integration on pushes to the production branch. Required environment variables are managed through the Vercel project settings and must mirror `.env.example` (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `CRON_SECRET`, `ADSENSE_ID`, `NEXT_PUBLIC_AXIOM_DATASET`, `NEXT_PUBLIC_AXIOM_TOKEN`).

The MySQL database is reachable from Vercel's serverless functions over the public network — make sure the database host whitelists Vercel's egress and that connections use TLS.

See the official [Vercel deployment guide for T3](https://create.t3.gg/en/deployment/vercel) for details.

### Docker (legacy / netcup)

```bash
docker compose up --build -d
```

The container exposes port `3000` internally (mapped to `127.0.0.1:8080` by `docker-compose.yml`) and is intended to sit behind a reverse proxy on the netcup host. This path is no longer the recommended deployment target.

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available)

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — feedback and contributions are welcome!
