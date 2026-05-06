# Vercel / Next.js Best Practices Audit

Audit of the codebase against the App Router conventions in the Next.js 15 docs and the Vercel hosting model.

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
| `experimental.useCache` enabled in `next.config.mjs` | ✅ | `experimental.useCache: true`. |
| `"use cache"` + `cacheLife("hours")` + `cacheTag(...)` on every read | ✅ | All 7 functions in `src/server/db/queries.ts:QUERIES`. |
| Cache tags invalidated on writes | ✅ | `MUTATIONS.insertAirports` calls `revalidateTag` for all read tags. |
| ⚠️ `aeroportAirports` and `militaryAirports` tags are not invalidated | ⚠️ | `revalidateTag` covers `vfrAirports`, `ifrAirports`, `heliports`, `airport`, `airports` — **but misses** `militaryAirports` and `aeroportAirports`. France pages will serve stale data until natural cache expiry (hours). **Action item.** |

## i18n (next-intl)

| Practice | Verdict | Evidence |
| --- | --- | --- |
| `defineRouting` + `createNavigation` (modern API) | ✅ | `src/i18n/routing.ts`. |
| `getRequestConfig` with `requestLocale` (not `unstable_setRequestLocale`) | ✅ | `src/i18n/request.ts`. v4-compatible. |
| `localePrefix.mode: "always"` for canonical URLs | ✅ | Every URL is locale-prefixed; matches `trailingSlash: true`. |
| Per-locale `pathnames` for SEO-friendly slugs | ✅ | `airport-list` localised to native-language slug per country. |
| Message bundles cover all locales | ✅ | 9 bundles, each ~175 lines. |
| `setRequestLocale` called in every page | ✅ | Verified in each locale-scoped page. Required for static rendering with i18n. |

## Vercel-specific

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Env vars validated at runtime | ✅ | `@t3-oss/env-nextjs` + Zod in `src/env.js`. `SKIP_ENV_VALIDATION` only used in CI/Docker builds. |
| No persistent filesystem assumptions | ✅ | Crawlers are split out to netcup; no `fs.writeFile` paths in website code. |
| No long-running request handlers | ✅ | API routes are short and DB-bound; no streaming SSE or background jobs. |
| Edge-runtime safety in middleware | ✅ | `src/middleware.ts` uses only Web APIs (`NextRequest`, `URL`, `Headers`). No Node-only `fs`, `child_process`, etc. |
| Image optimisation via `next/image` | ❌ | `next/image` is **not used anywhere**. The header logo is referenced but not via the `<Image>` component. This is a missed optimisation — Vercel's image CDN (with WebP/AVIF, automatic sizing, lazy loading) is free for Pro and the project already includes `aip-logo-*.jpg` and `logo.webp` in `public/`. **Action item.** |
| Bundle analyzer wired up | ❌ | No `@next/bundle-analyzer` in `package.json`. Useful for the next perf pass; see `performance.md`. |
| Speed Insights / Web Analytics | ❌ | Not enabled. Vercel offers both free; recommend enabling Speed Insights at minimum to track Core Web Vitals on the live site. |
| `output: "standalone"` | ⚠️ | Set in `next.config.mjs`. Vercel ignores it (it's left over from the legacy Docker image). Harmless but stale. CLAUDE.md already notes this. |

## SEO

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Canonical URLs on every page | ✅ | `alternates.canonical` in every `generateMetadata`. |
| `hreflang` alternates | ✅ | Built per-locale; the middleware also rewrites the `link` header to map next-intl's locale codes to BCP-47 language tags via `localeLangMapping`. |
| OpenGraph + Twitter card metadata | ✅ | Every page. |
| Dynamic sitemaps | ✅ | `src/app/2d6a9a/sitemap.ts` per country, plus `index.xml/route.ts` aggregator. |
| Structured data (JSON-LD) | ✅ | BreadcrumbList, Product, Airport, WebSite, SiteNavigationElement, WebPage — see `src/components/schemas/`. |
| `robots.txt` and `ads.txt` | ✅ | In `public/`. |
| Obfuscated sitemap path (`/2d6a9a/`) | ✅ | Intentional, documented in CLAUDE.md. |

## Code organisation

| Practice | Verdict | Evidence |
| --- | --- | --- |
| Path aliases (`~/*` → `./src/*`) | ✅ | `tsconfig.json` configured, used consistently. |
| `"use server"` actions in `src/server/` | ✅ | `src/server/actions.ts`. |
| `"server-only"` for DB module | ✅ | `src/server/db/queries.ts:1` declares `"server-only"`. Keeps the connection pool out of any accidental client bundle. |
| shadcn/ui primitives in `src/components/ui/` | ✅ | 7 components, configured via `components.json` for the new-york style. |
| Strict TypeScript | ✅ | `tsconfig.json` with `"strict": true`. |
| Drizzle multi-project schema with prefix | ✅ | `mysqlTableCreator((name) => \`aip_aero_v4_${name}\`)`. |

## Tooling gaps

| Item | Status | Note |
| --- | --- | --- |
| ESLint | ❌ | `.eslintrc.mjs` is half-migrated to flat config (uses `tseslint.config()` from a package not installed). `next lint` falls into an interactive prompt. CI doesn't run lint. **Tracked in CLAUDE.md.** |
| Prettier | ✅ | Runs in CI. `.prettierignore` excludes `crawlers/.venv/`, `node_modules`, etc. |
| Format-on-save guidance | N/A | No editor config in repo; up to contributors. |
| `pnpm build` in CI | ❌ (intentional) | Build pre-renders sitemaps, which hit MySQL. CI has no DB. Vercel preview build does this on every PR and posts a status check; that's the build gate. Documented. |

## Required action items (ranked)

1. ✅ **Fixed.** `MUTATIONS.insertAirports` now revalidates all seven cache tags including `militaryAirports` and `aeroportAirports`.
2. ✅ **Fixed.** `src/components/header.tsx` now uses `next/image` with `priority`.
3. ✅ **Done.** `<SpeedInsights />` is wired into `src/app/[locale]/layout.tsx`. Field data will start populating after the next production deploy.
4. ⏸ **Deferred.** ESLint config is still half-broken — out of scope for this batch; needs a focused PR.
5. **(Lower priority)** Drop `output: "standalone"` from `next.config.mjs` once the Docker setup is formally retired. Harmless to leave.

---

_Last updated: 2026-05-06._
