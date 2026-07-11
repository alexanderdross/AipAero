# Cloudflare Workers / Next.js Best Practices Audit

Audit of the codebase against the App Router conventions in the Next.js 15 docs and the Cloudflare Workers hosting model.

## Methodology

For each conventional best practice, mark it ✅ (followed), ⚠️ (partial / minor issue), ❌ (not followed / known gap), or N/A. Each finding cites the file path so the verdict is reproducible.

## App Router fundamentals

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Server Components by default; `"use client"` only when needed | ✅ | 11 client components, all justified (Radix-driven menu/select/drawer, search input with state). Server pages are server. |
| Static generation where possible | ✅ | All `[locale]` pages declare `export const dynamicParams = false` and `generateStaticParams()` (15 hits). |
| Async + suspense for streamed sections | ✅ | `<Suspense fallback={<LoadingList />}>` in `airport-list/page.tsx`; root layout wraps the locale switcher. |
| `loading.tsx` colocated with route segments | ✅ | `src/app/[locale]/(search)/loading.tsx`, `airport-list/loading-list.tsx`. |
| `error.tsx` for error boundaries | ✅ | `src/app/[locale]/error.tsx` exists and is a client component (required). |
| `not-found.tsx` for 404s | ✅ | Both global (`src/app/not-found.tsx`) and locale-scoped. |
| `metadata` / `generateMetadata` for SEO | ✅ | Every page exports `generateMetadata` returning `Metadata` with i18n title/description, alternates, OG. |

## Caching & revalidation

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Reads wrapped in a cache primitive | ✅ | `unstable_cache` in `src/server/db/queries.ts`. The newer `"use cache"` directive is **not** used and `experimental.useCache` is intentionally **not** enabled - the OpenNext Cloudflare adapter doesn't support it yet. |
| `unstable_cache` + `revalidate: 86400` + per-country `country:<CC>` tags on every cached read | ✅ | The cached reads in `src/server/db/queries.ts:QUERIES` (the as-you-type search is deliberately uncached). |
| Cache tags invalidated on writes | ✅ | `MUTATIONS.insertAirports` calls `revalidateTag` with the `country:<CC>` tag for the country it just wrote. |
| Per-country invalidation covers all page types | ✅ | Resolved: invalidation is now a single per-country `country:<CC>` tag, which busts every one of that country's cached reads - including `militaryAirports` and `aeroportAirports`. (Previously each read was busted by a per-type tag, and `militaryAirports` / `aeroportAirports` were missed, leaving France pages stale until cache expiry.) |

## i18n (next-intl)

| Practice | Verdict | Evidence |
| --- | --- | --- |
| `defineRouting` + `createNavigation` (modern API) | ✅ | `src/i18n/routing.ts`. |
| `getRequestConfig` with `requestLocale` (not `unstable_setRequestLocale`) | ✅ | `src/i18n/request.ts`. v4-compatible. |
| `localePrefix.mode: "always"` for canonical URLs | ✅ | Every URL is locale-prefixed; matches `trailingSlash: true`. |
| Per-locale `pathnames` for SEO-friendly slugs | ✅ | `airport-list` localised to native-language slug per country. |
| Message bundles cover all locales | ✅ | 9 bundles, each ~175 lines. |
| `setRequestLocale` called in every page | ✅ | Verified in each locale-scoped page. Required for static rendering with i18n. |

## Hosting-specific (Cloudflare Workers)

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Env vars validated at runtime | ✅ | `@t3-oss/env-nextjs` + Zod in `src/env.js`. `SKIP_ENV_VALIDATION` only used in CI/Docker builds. |
| No persistent filesystem assumptions | ✅ | Crawlers are split out to the self-hosted GitHub Actions runner; no `fs.writeFile` paths in website code. |
| No long-running request handlers | ✅ | API routes are short and DB-bound; no streaming SSE or background jobs. |
| Edge-runtime safety in middleware | ✅ | `src/middleware.ts` uses only Web APIs (`NextRequest`, `URL`, `Headers`). No Node-only `fs`, `child_process`, etc. |
| Image optimisation via `next/image` | ✅ | Resolved for the header: `src/components/header.tsx` renders `<Image priority>` from `next/image`. The Workers runtime doesn't run the Next image optimizer (`next.config.mjs` sets `images.unoptimized: true`), so this buys correct sizing, `priority`/lazy defaults, and layout stability rather than server-side WebP/AVIF. Any remaining raw assets in `public/` (`aip-logo-*.jpg`, `logo.webp`) are the next targets. |
| Bundle analyzer wired up | ❌ | No `@next/bundle-analyzer` in `package.json`. Useful for the next perf pass; see `performance.md`. |
| Speed Insights / Web Analytics | ✅ | Cloudflare Web Analytics is in use - the RUM beacon is injected at the Cloudflare edge (allowlisted in the `next.config.mjs` CSP: `static.cloudflareinsights.com` / `cloudflareinsights.com`), so Core Web Vitals are collected without any app-code snippet. No `@vercel/speed-insights` dependency. Read CWV in the Cloudflare dashboard. |
| `output: "standalone"` | ✅ | Removed from `next.config.mjs` - the OpenNext adapter produces the Worker bundle, so the legacy Docker `standalone` flag is gone. |

## SEO

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Canonical URLs on every page | ✅ | `alternates.canonical` in every `generateMetadata`. |
| `hreflang` alternates | ✅ | Built per-locale; the middleware also rewrites the `link` header to map next-intl's locale codes to BCP-47 language tags via `localeLangMapping`. |
| OpenGraph + Twitter card metadata | ✅ | Every page. |
| Dynamic sitemaps | ✅ | `src/app/2d6a9a/sitemap.ts` per country, plus `index.xml/route.ts` aggregator. |
| Structured data (JSON-LD) | ✅ | BreadcrumbList, Product, Airport, WebSite, SiteNavigationElement, WebPage - see `src/components/schemas/`. |
| `robots.txt` and `ads.txt` | ✅ | In `public/`. |
| Obfuscated sitemap path (`/2d6a9a/`) | ✅ | Intentional, documented in CLAUDE.md. |

## Code organisation

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Path aliases (`~/*` → `./src/*`) | ✅ | `tsconfig.json` configured, used consistently. |
| `"use server"` actions in `src/server/` | ✅ | `src/server/actions.ts`. |
| `"server-only"` for DB module | ✅ | `src/server/db/queries.ts:1` declares `"server-only"`. Keeps DB access (the D1 binding) out of any accidental client bundle. |
| shadcn/ui primitives in `src/components/ui/` | ✅ | 7 components, configured via `components.json` for the new-york style. |
| Strict TypeScript | ✅ | `tsconfig.json` with `"strict": true`. |
| Drizzle multi-project schema with prefix | ✅ | `sqliteTableCreator((name) => \`aip_aero_v4_${name}\`)`. |

## Tooling gaps

| Item | Status | Note |
| --- | --- | --- |
| ESLint | ✅ | Migrated to flat config: `eslint.config.mjs` is in place and `pnpm lint` (`eslint .`) runs as a gating step in the `Website (Next.js)` CI job. |
| Prettier | ✅ | Runs in CI. `.prettierignore` excludes `crawlers/.venv/`, `node_modules`, etc. |
| Format-on-save guidance | N/A | No editor config in repo; up to contributors. |
| `pnpm cf-build` in CI | ✅ | The OpenNext Worker build runs in CI. It needs no DB - build-time D1 reads fail-soft to empty and revalidate at runtime - so it gates PRs directly. The former Vercel preview build is retired. |

## Required action items (ranked)

1. ✅ **Fixed.** `MUTATIONS.insertAirports` now revalidates all seven cache tags including `militaryAirports` and `aeroportAirports`.
2. ✅ **Fixed.** `src/components/header.tsx` now uses `next/image` with `priority`.
3. ✅ **Done (via Cloudflare Web Analytics).** Web Vitals are collected by the Cloudflare edge RUM beacon (allowlisted in the CSP), not by app code - there is no `@vercel/speed-insights` / `<SpeedInsights />`. Read CWV in the Cloudflare dashboard.
4. ✅ **Done.** ESLint migrated to flat config (`eslint.config.mjs`); `pnpm lint` now runs as a gating step in CI.
5. ✅ **Done.** `output: "standalone"` has been removed from `next.config.mjs`.

---

_Last updated: 2026-07-11._
