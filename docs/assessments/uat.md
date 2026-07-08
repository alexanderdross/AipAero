# UAT Assessment

## What this is

User Acceptance Testing is, by definition, a human-driven evaluation against business expectations. This document is a **runbook + checklist** for a person to walk through the live site and the crawler ingestion path, confirming each user-facing behaviour matches what's described in `CLAUDE.md` and the README.

## Scope

| Surface | Depth |
| --- | --- |
| Website (Cloudflare Workers) | Every locale × every country-applicable page; search; airport detail. |
| Crawlers (netcup) | One scheduled cycle observed end-to-end via systemd. |
| Backend ingest | One real POST verified, plus a forged POST verified to be 401. |

## Pre-flight

Before running UAT, confirm these aren't currently in flight:

- [ ] No PR is mid-merge to `main`.
- [ ] The most recent Cloudflare Workers production deploy is from `main` and green.
- [ ] netcup `aip-crawler.timer` is `active (waiting)` — `systemctl status aip-crawler.timer`.
- [ ] You can reach `https://aip.aero/` from a clean browser session.

## A — Website golden paths (per locale)

The site has 9 locales: `at`, `at-EN`, `de`, `de-EN`, `fr`, `fr-EN`, `nl`, `nl-EN`, `uk`. UAT all 9, but you can batch by language family.

For each locale, walk through:

1. **Country landing card grid** — `/<locale>` should load < 2 seconds and show the correct page-availability icons (e.g. no `/ifr` card for non-DE).
2. **Locale switcher** — clicking a different locale on the same page lands you on the canonical equivalent (e.g. `/de/vfr` → `/uk/vfr`, not `/de/vfr` → `/uk/`).
3. **Airport list** — the localised pathname loads (`/at/flughafen-liste-oesterreich`, `/fr/liste-des-aeroports-francais`, etc.) and shows airports for the country.
4. **Search-page entry** — VFR / IFR / heliports / military / aeroports as applicable per [the page-availability matrix](../../CLAUDE.md#country-specific-page-availability).
5. **Search box** — typing a partial airport name returns results within ~1s.
6. **Airport detail link** — clicking through opens the official AIP/chart URL in a new tab. Verify the link is the correct AIP source, not an old crawl.

For at least **one** locale per language (say `de`, `fr`, `nl`, `uk`):

- [ ] `/<locale>` loads.
- [ ] Locale switcher round-trips correctly to all 9 locales without 404.
- [ ] All applicable search pages load (VFR / IFR / heliports / military / aeroports per the matrix).
- [ ] Airport list page loads with non-empty content.
- [ ] Search returns relevant results for a partial ICAO (e.g. `EDD` → multiple Berlin airports).
- [ ] Search returns relevant results for a partial city name (e.g. `Wien` → LOWW).
- [ ] Empty / nonsense search returns 0 results gracefully (no crash).
- [ ] Clicking an airport opens the source AIP URL.

## B — Country-page availability matrix

Confirm each country shows only its applicable pages (per `CLAUDE.md`):

| Country | /vfr | /ifr | /heliports | /military | /aeroports | /airport-list |
| --- | --- | --- | --- | --- | --- | --- |
| UK | ✅ | – | ✅ | – | – | ✅ |
| DE | ✅ | ✅ | ✅ | – | – | ✅ |
| FR | – | – | – | ✅ | ✅ | ✅ |
| NL | ✅ | – | ✅ | – | – | ✅ |
| AT | ✅ | – | ✅ | – | – | ✅ |

Verify by:

- Loading the country landing page (`/de`, `/fr`, etc.) and counting the cards.
- Attempting to navigate directly to a non-applicable page (`/fr/vfr/`) and confirming you land on the global 404 (`not-found.tsx`), not a 500 or a blank list.

## C — SEO / structured-data sanity

- [ ] View page source on `/uk/airport-list-uk` and verify a `<script type="application/ld+json">` block with `@type: "BreadcrumbList"` and one with `@type: "Product"`.
- [ ] `<link rel="alternate" hreflang="...">` tags are present and use BCP-47 language codes (`en-GB`, `de-DE`, …) — not the next-intl internal locale codes (`uk`, `de-EN`).
- [ ] `<link rel="canonical">` matches the loaded URL exactly (including trailing slash).
- [ ] Visiting `https://aip.aero/2d6a9a/sitemap.xml` returns a sitemap index XML with one `<sitemap>` per country.
- [ ] One per-country sitemap (e.g. `/2d6a9a/sitemap/de.xml`) returns a valid `<urlset>` with all DE pages.

## D — Crawler ingestion path

On the netcup host, observe one timer cycle:

```bash
systemctl status aip-crawler.timer
journalctl -u aip-crawler --since "10 minutes ago" -f
```

Expect:

- [ ] Timer fires on schedule.
- [ ] For each country (AT, DE, FR, NL, UK), a "Starting crawler: XX" log line.
- [ ] Each finishes in seconds — all five crawlers are now on the HTTP path.
- [ ] "Successfully wrote output for XX" appears once per country at the API call.
- [ ] No `error_logs/` files or leftover browser screenshots written for any of AT/DE/FR/NL/UK (all on the HTTP path).

## E — Backend ingest endpoint

Two short curls from anywhere:

```bash
# 1. Authorised — valid empty payload (no airports, returns 200).
curl -i -X POST https://aip.aero/api/airports \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '[]'
# expect: HTTP/2 200, body {"message":"No airports to insert"}

# 2. Unauthorised.
curl -i -X POST https://aip.aero/api/airports \
  -H "Authorization: Bearer wrong-secret" \
  -H "Content-Type: application/json" \
  -d '[]'
# expect: HTTP/2 401, body {"error":"Unauthorized"}

# 3. Authorised, invalid body (Zod rejection).
curl -i -X POST https://aip.aero/api/airports \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '[{"icao":"X","title":"","url":"","type":"bogus","country":"DE"}]'
# expect: HTTP/2 400, body {"message":"Validation error","errors":[...]}
```

- [ ] Authorised empty POST → 200 with the no-airports message.
- [ ] Wrong secret → 401 with the standard error body, and a log line in Axiom showing the IP.
- [ ] Invalid body → 400 with Zod's field-level errors (no 500 leakage).

## F — Performance / responsiveness (subjective)

Pull these out of Cloudflare Web Analytics (Core Web Vitals; see [`performance.md`](./performance.md)). For a quick manual pass:

- [ ] LCP on `/uk/airport-list-uk` feels < 2.5 seconds on a typical broadband connection.
- [ ] Search input response feels instant (< 200 ms from keystroke to result).
- [ ] No layout shift when the locale switcher hydrates.
- [ ] First-load JS doesn't visibly stutter on a mid-range mobile.

## G — Accessibility quick-pass

Not a full WCAG audit, but a sanity check:

- [ ] Tab key navigates through the menu and search field in visible order.
- [ ] Focus rings are visible on interactive elements.
- [ ] Screen-reader (VoiceOver / NVDA) reads the country card titles, not "img" or empty spans.
- [ ] Locale switcher is keyboard-operable.
- [ ] No blocking pop-ups or modals on initial load.

## Sign-off

| Area | Pass | Notes |
| --- | --- | --- |
| A — Locale golden paths |  |  |
| B — Country page-availability |  |  |
| C — SEO / structured data |  |  |
| D — Crawler ingestion |  |  |
| E — Backend ingest |  |  |
| F — Performance feel |  |  |
| G — Accessibility quick-pass |  |  |

If any area fails, file an issue with:

- The exact URL / curl / journalctl output.
- Browser + OS (for website issues).
- Whether the failure is a regression (worked previously) or a new bug.

---

_This is a runbook, not an executed assessment. Mark dates as you complete sections._
