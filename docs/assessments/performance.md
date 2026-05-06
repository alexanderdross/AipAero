# Performance Assessment

## Honest framing

I don't have access to the live site from this sandbox and the repo has no perf harness. This document is therefore:

- **Static analysis** of code patterns that are known performance levers (Vercel/Next.js conventions, caching strategy, bundle composition, image handling).
- A **runbook** for the user / CI pipeline to gather real numbers (Lighthouse, Web Vitals, bundle analyser) once enabled on Vercel.

Treat findings here as "things to fix that will help" and verify each with measurements *after* applying.

## Static-analysis findings

### Caching strategy — strong but with two missing invalidations

The website is read-heavy and cache-friendly: every page is statically generated with `dynamicParams = false`, and DB reads go through `"use cache"` server functions tagged per-country. This is exactly the right pattern for Vercel's serverless runtime — most page renders never hit MySQL.

**Bug:** `MUTATIONS.insertAirports` (`src/server/db/queries.ts`) calls `revalidateTag` for 5 of the 7 read tags, missing `militaryAirports` and `aeroportAirports`. France pages serve stale data for `cacheLife("hours")` after each crawl. Fix by adding two more `revalidateTag` calls. (Also captured in [`best-practices.md`](./best-practices.md).)

### Static prerendering — covers all hot paths

15 occurrences of `generateStaticParams` / `dynamicParams = false` across the locale-prefixed pages. With nine locales × five page types, that's a small, finite static surface that prerenders at build time. Vercel serves these from CDN with no compute cost per request.

The exception is the per-airport detail page, addressed via search-param key (`/vfr?EDNY`) rather than path segments — same prerendered shell + client-side resolution. Good for caching; the only DB hit per detail view is the cached `airport` query.

### Image optimisation — gap

`next/image` is **not used anywhere**. The `public/` directory has `logo.webp`, `aip-logo-446x319.jpg`, `aip-logo-450x450.jpg` — likely loaded via raw `<img>` or as a CSS background. Without `next/image` you lose:

- Automatic WebP/AVIF negotiation (we already have a webp).
- `loading="lazy"` defaults.
- Auto `srcset` based on viewport.
- Build-time size warnings for oversized assets.

Single highest-leverage fix in this assessment.

### Client bundle composition

11 `"use client"` components. Spot-checked:

- `menu`, `mobile-menu`, `breadcrumbs`, `locale-switcher`, `locale-switcher-select`, `search-input-field` — necessary for the interactive surface.
- The schema-* components (`schema-product`, `schema-website`, `schema-webpage`) declare `"use client"` but only render `<script type="application/ld+json">` JSON-LD blobs. **They don't actually need to be client components** — JSON-LD is fully server-renderable. Moving them to server components would shave ~a few KB of React runtime and Radix bindings off the client bundle on every page. **Worth checking.**

Action: audit the `src/components/schemas/*.tsx` files and remove `"use client"` from any that don't use hooks/event handlers.

### Heavy deps

From `package.json`:

| Dep | Version | Bundle impact | Notes |
| --- | --- | --- | --- |
| `cheerio` | ^1.1.2 | Server-only? | If imported into any RSC that ends up in the client bundle, this is a 200KB+ regression. Worth `grep -rn 'from "cheerio"' src` to confirm; appears unused in src today, leftover from earlier crawler exploration. **Consider removing.** |
| `lodash` | ^4.18.1 | Client risk | If only used for one or two helpers, swap for native ES or named imports (`lodash/get`) to avoid the full ~70KB. |
| Radix UI primitives | various | Modest | Tree-shakes well; current usage is fine. |
| `lucide-react` | ^0.474.0 | Modest | Per-icon imports in components — looks correct. |
| `dayjs` | ^1.11.19 | Small | Fine; far better than moment. |

### Database — no N+1 risk

All page-level data fetching uses single `findMany` / `findFirst` calls. No nested loops over country lists doing per-row queries. The cache-tag invalidation pattern means DB load is bounded by crawler frequency, not request volume.

### Middleware overhead

`src/middleware.ts` runs on every non-static request. It:

1. Checks pathname against a regex of locales — O(1).
2. Calls `handleI18nRouting(request)` (next-intl middleware).
3. Parses + rewrites the `link` header for hreflang customisation.

The middleware matcher already excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, etc. The link-header rewrite is fine; not a hot loop.

### `dangerouslySetInnerHTML` JSON-LD

14 sites embed JSON-LD via `dangerouslySetInnerHTML`. This is the canonical pattern in the Next.js docs and is fine performance-wise — each JSON.stringify happens once at render time, output is cacheable.

## Runbook — measuring the live site

Once on Vercel, gather real numbers:

### 1. Vercel Speed Insights

Free on all plans. Enable in the Vercel dashboard → project settings → Speed Insights → Enable. Add the React snippet to `src/app/[locale]/layout.tsx`:

```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
// ...
<body>
  {children}
  <SpeedInsights />
</body>
```

This reports field-data Core Web Vitals (LCP, FID/INP, CLS) for real visitors, broken down by country and route. Over ~1 week of traffic you'll have a per-locale CWV baseline.

### 2. Lighthouse on representative pages

Headless Chrome (`lighthouse`) or DevTools, against:

- `https://aip.aero/uk/airport-list-uk` (largest list, most rendered content)
- `https://aip.aero/de/vfr` (typical search page)
- `https://aip.aero/fr/liste-des-aeroports-francais` (FR-only path)
- `https://aip.aero/` (root, country selector)

Record:

- LCP target ≤ 2.5s (good), 4.0s (poor)
- INP target ≤ 200ms
- CLS target ≤ 0.1

### 3. Bundle analysis

Add `@next/bundle-analyzer` to `devDependencies` and wrap the config:

```js
import withBundleAnalyzer from '@next/bundle-analyzer';
const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
export default analyze(withAxiomNextConfig(withNextIntl(nextConfig)));
```

Then `ANALYZE=true pnpm build` produces an HTML treemap. Look for:

- Any single chunk > 150KB gzipped.
- `cheerio`, `lodash`, or `selenium-*` accidentally in the client bundle.
- Duplicate `@formatjs/*` (next-intl bumped to v4 with AOT compilation; verify it's not pulling both runtime and AOT paths).

### 4. Database query timings

Drizzle Studio (`pnpm db:studio`) plus a `console.time` around the cached query functions in dev. The cache-hit path is microseconds; cache-miss should be < 50 ms against a healthy MySQL.

### 5. Crawler timing baseline

In production logs (`journalctl -u aip-crawler`):

| Country | Pre-port (Selenium) | Post-port (httpx) |
| --- | --- | --- |
| AT | (record) | (record) |
| NL | (record) | (record) |
| UK | (record) | (record) |
| FR | (record) | (record) |
| DE | (record) | (still Selenium) |

Expectation: post-port runs are 5-20× faster, depending on page count, since they remove Chromium boot + JS execution + per-frame waits.

## Recommended action items, ranked by ROI

1. **Add the two missing `revalidateTag` calls** (military, aeroport). Trivial fix, eliminates stale data on FR pages. Code change.
2. **Migrate header / OG images to `next/image`.** One-component change, real Core Web Vitals (LCP) improvement.
3. **Audit `src/components/schemas/*.tsx` for unnecessary `"use client"`.** Probably 3-4 components moveable to server, reducing client JS.
4. **Enable Vercel Speed Insights.** ~10 lines of code, gives real-user data we can act on next time.
5. **Verify `cheerio` isn't shipped to clients** (probably unused in `src/`). If unused, drop it from `package.json`.
6. **Wire up `@next/bundle-analyzer`** as a `pnpm analyze` script for occasional health checks.

After applying 1–4, take a fresh Lighthouse + Speed Insights read and update this doc with numbers.

---

_Last updated: 2026-05-06. No live measurements yet — see runbook above._
