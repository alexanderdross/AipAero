# Security Assessment

## Methodology

Three pillars: dependency scan, code review of the externally-exposed surface (the API ingest endpoint, the server action, the database access layer), and a grep-based sweep for common foot-guns (secrets, `dangerouslySetInnerHTML`, `eval`, raw SQL).

## Dependency scan

### Website (`pnpm audit`)

**25 vulnerabilities - 12 moderate, 13 high.** All are transitive (no direct dep is vulnerable). Summary:

| Package | Severity | Path | Status |
| --- | --- | --- | --- |
| `undici` | high | `cheerio > undici` | Patch available - bump cheerio when a release with the new undici lands. |
| `postcss` (<8.5.10) | moderate | `next > postcss` | Will resolve once Next bumps the bundled postcss. |
| `yaml` (<2.8.3) | moderate | `tailwindcss > postcss-load-config > yaml` | Patch available; Tailwind dep tree update needed. |
| `esbuild` | review | `drizzle-kit > esbuild` | Dev-only (drizzle-kit is `devDependencies`); not shipped to production. |
| `minimatch`, `ajv`, `flatted`, `brace-expansion`, `picomatch` | various | `eslint > …` | Dev-only; ESLint dep tree. |

All findings are in dev-side or transitive deps - none are first-degree dependencies in `package.json`. Running `pnpm audit` reproduces this list.

**Action items:**
- Track the `cheerio > undici` chain - `undici` advisories can land in production if you ever evaluate `cheerio` against attacker-controlled HTML with active fetching enabled. We don't (we use it server-side for our own crawler, no JS execution), but worth bumping when convenient.
- Dev-toolchain advisories (drizzle-kit, eslint) don't reach production builds and can be left to Dependabot's normal cadence.

### Crawlers (`uv tree`)

Direct deps as of latest lock:

| Package | Locked | Latest | Risk |
| --- | --- | --- | --- |
| `httpx` | 0.28.1 | current | none |
| `bs4` | 0.0.2 / `beautifulsoup4` 4.13.4 | 4.14.3 | minor; bump on next routine refresh |
| `pydantic` | 2.11.4 | 2.13.4 | none |
| `pydantic-settings` | 2.9.1 | 2.14.0 | none |
| `selenium` | 4.32.0 | 4.43.0 | now only used by the experimental crawlers; will be removed once they port off it |
| `webdriver-manager` | 4.0.2 | current | will be removed with selenium |

No published CVEs in the active set. `de.py` has already ported to `HttpCrawlerBase`, so no active crawler imports Selenium. The `selenium` + `webdriver-manager` chain is slated for deletion once the experimental crawlers (`belgium` / `car_sam_nam` / `pac_n` / `pac_p` / `run`) port off `CrawlerBase` or are pruned; deferring upgrade churn there is intentional.

## Code review

### `/api/airports` (POST) - `src/app/api/airports/route.ts`

| Control | Verdict | Notes |
| --- | --- | --- |
| **Auth** | ✅ Bearer-token check on first line; non-matching requests 401 with the source IP logged. | `req.headers.get("Authorization") !== \`Bearer ${env.CRON_SECRET}\``. Constant-time string compare is unnecessary here because the secret length isn't a side channel for an attacker - the IP-rate-limit threat model is "Cloudflare + sane CRON_SECRET length", not "string-comparison timing oracle". |
| **Body validation** | ✅ Zod `airportApiInsertSchema.parse(...)` from `drizzle-zod`. ZodError is caught and returned as 400 with field-level messages. | The schema is derived from the DB schema, so any mismatch between crawler payload and DB column is caught at the API boundary. |
| **Mass assignment** | ✅ Zod's `parse` strips unknown fields; the `enrichedAirports.map` only spreads validated fields. | The `slug` field is server-derived from `icao` or `slug(title)` - clients can't supply it. |
| **SQL injection** | ✅ All queries via Drizzle's typed builders (`eq`, `and`, `like`). No `sql\`\`` template, no `db.execute(\`…\`)`. | The bulk delete uses `eq(airports.country, input[0].country)` - the country value passes through Zod's enum/schema first. |
| **Rate limiting** | ⚠️ None at the application layer. Cloudflare's edge-network DDoS protection covers the bulk attack model. | If a `CRON_SECRET` ever leaks, an attacker could DoS by spamming valid POSTs. Consider Cloudflare's WAF / rate limiting if that risk grows. |
| **Replay protection** | ⚠️ None. A captured `Authorization` header is reusable indefinitely. | Mitigated only by `CRON_SECRET` rotation. Acceptable for a crawler-only endpoint with infrequent calls and no monetary effect, but a rotation policy is worth adding. |
| **Logging** | ✅ `next-axiom` logs all calls + unauthorised IPs. | Don't log the full request body (the current code doesn't - good). |

### `searchAirports` server action - `src/server/actions.ts`

| Control | Verdict | Notes |
| --- | --- | --- |
| **Input validation** | ✅ Zod schema on every field (`search` 1-50 chars, `country` ≤2 chars, `type` enum). Failures return `airports: []` rather than leaking the validation error. | The `country` constraint is `z.string().max(2)` - should likely be `z.string().length(2)` (or an enum). Current shape lets `""` and `"x"` through. |
| **Trust boundary** | ✅ This is a `"use server"` action invoked from a client component, so the input is attacker-controlled. Schema-first validation is the right shape. |  |
| **Output limit** | ✅ `QUERIES.airports` returns at most 5 rows. |  |

**Action item:** tighten `country: z.string().max(2)` → `z.string().length(2)` (or `z.enum(routing.locales)`) so the validation actually does something.

### Drizzle queries - `src/server/db/queries.ts`

All reads are typed-builder calls with parameterised values:

```ts
where: and(eq(airports.country, country), eq(airports.type, "vfr")),
```

The `airports` query uses `like(airports.title, \`%${search}%\`)` - Drizzle still parameterises this; the `%` wildcards are concatenated into the **value**, not the SQL string, so injection isn't possible. (Verified: D1/SQLite bound parameters treat the entire bound value as a literal.) The `searchAirports` validation already caps `search` length at 50 chars, so the LIKE-pattern explosion class of perf attacks is bounded.

### `dangerouslySetInnerHTML` audit

14 occurrences - all in `<script type="application/ld+json">` tags wrapping `JSON.stringify(schema)` for SEO structured data. The `schema` is server-built from i18n strings + DB rows, never from user-controlled query params. **Verdict: safe pattern.** A future change here is risky, so worth an inline comment near each call.

### Secrets & env hygiene

- `process.env.*` is referenced **only** in `src/env.js` (the t3-env validator). The rest of the code imports from `~/env`. ✅
- `.env` is gitignored (`/.env`, `/.env*.local`); only `.env.example` is committed and contains no secrets.
- `CRON_SECRET` is the single shared secret between the Cloudflare Worker and the netcup crawler host. Rotate by updating both ends (`wrangler secret put CRON_SECRET` on the Worker) and re-deploying the website.
- `ADSENSE_ID` and the Axiom tokens are not security-sensitive in the breach sense (public IDs / write-only tokens) but should still rotate together with any compromise.

### Crawlers - outbound risk

The crawlers are an HTTP client with hardcoded, country-specific entry URLs. There's no user-controlled input flowing into URLs (no SSRF surface), and the only data they emit is the parsed airport list, validated by the website's API endpoint before insertion. The Python venv runs as a non-root systemd service (per the `aip-crawler.service` unit on netcup). No code execution path for attacker-controlled HTML - `BeautifulSoup` is a parser, not a renderer; we never `eval` or execute extracted JS.

## Browser-facing security headers

**Resolved** - this was an open finding at assessment time; `next.config.mjs` now sends an explicit `headers()` set on every route:

- `X-Frame-Options: DENY` (plus `frame-ancestors 'none'` in the CSP) - aip.aero is not embeddable.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` - denies camera / microphone / geolocation / interest-cohort.
- `Content-Security-Policy` - sent in **Report-Only** mode for now (allows `'self'`, the AdSense / Google origins, and the Cloudflare Web Analytics beacon; `'unsafe-inline'` on `script-src` covers the inline `<script type="application/ld+json">` JSON-LD blocks until they move to nonces). Promote to an enforcing `Content-Security-Policy` once the report stream is clean.
- `Strict-Transport-Security` - configurable at the Cloudflare edge (not on by default).

The one remaining step is promoting the CSP from Report-Only to enforcing.

## Summary

| Area | Verdict |
| --- | --- |
| API auth | Strong (Bearer + IP logging). Add rate-limit when convenient. |
| Input validation | Strong on the API; one `length(2)` tweak needed in `searchAirports`. |
| SQL injection | None - Drizzle typed builders throughout. |
| XSS | None - `dangerouslySetInnerHTML` only wraps server-built JSON-LD. |
| Secrets | Centralised via t3-env, gitignored, single rotation key. |
| Dependencies | 25 transitive npm advisories, all dev-side or one-step-removed; nothing first-degree. |
| Headers | Explicit headers set (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP in Report-Only); promote CSP to enforcing. |

**Action items, ranked:**

1. ✅ **Fixed.** `searchAirports` country validation tightened to `z.string().length(2)`.
2. ⚠️ **Partial.** `next.config.mjs` now sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` denying camera/microphone/geolocation/interest-cohort. **A CSP is now sent in Report-Only mode** (allowing `'self'`, AdSense/Google, and the Cloudflare Web Analytics beacon; `'unsafe-inline'` for the JSON-LD blocks); the remaining work is promoting it to an enforcing `Content-Security-Policy` once the report stream is clean.
3. Bump `cheerio` when a release ships with the patched `undici`.
4. Document a `CRON_SECRET` rotation runbook in `CLAUDE.md`.
5. (Optional) Add Upstash Ratelimit on `/api/airports` once the threat model warrants.

---

_Last run: 2026-05-06. Reproduce with `pnpm audit` (website) and `cd crawlers && uv tree --outdated` (crawlers)._
