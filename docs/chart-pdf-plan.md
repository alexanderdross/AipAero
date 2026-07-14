# Plan: Direct chart-PDF link (+ optional inline preview)

Goal: from an airport detail page, take the pilot **straight to the exact
approach-chart PDF** (and optionally preview it inline), instead of the AIP
index / frameset page they land on today.

**Status: the website side is implemented.** Where the stored `url` already
points at a PDF (`isPdfUrl`), the detail page renders a chart box
(`src/components/airport-chart.tsx`) with a direct "open PDF" link for the
primary chart, a collapsed list of open links for every other captured chart,
and `schema.org/DigitalDocument` JSON-LD (`schema-digital-document.tsx`). The
former inline `<object>` preview (`chart-preview.tsx`) was removed (14.07.2026):
a cross-origin AIP PDF embed is unreliable (hosts block framing, mobile does
not render PDFs inline - it showed an empty box) and only previewed one chart,
so the box is links-only.

**Stage 2 plumbing is also implemented:** the `airports` table carries a
nullable `pdf_url` column (migration 0005), the crawler `Airport` model has an
optional `pdf_url` (posted as `pdfUrl`, validated by the drizzle-zod API
schema), and the detail page prefers `airport.pdfUrl` over the `isPdfUrl(url)`
fallback for the chart box / offline chart save / DigitalDocument JSON-LD.
Nothing breaks while `pdf_url` is null.

**Stage 2 extraction is implemented for 9 countries** (12.07.2026):
`attach_pdf_urls()` in `HttpCrawlerBase` (opt-in via `FETCH_PDF_URLS`)
fetches every airport's chart page during the crawl and picks the most
relevant PDF via per-country priority regexes (`PDF_TEXT_PRIORITY` /
`PDF_HREF_PRIORITY`; fallback: the page's first PDF link). The patterns were
derived from `pdf_recon` runs of the crawler live-test workflow (the AIP
hosts are not reachable from the sandboxed agent environment):

| Country | Selector                                | Chart picked                                           |
| ------- | --------------------------------------- | ------------------------------------------------------ |
| AT      | text `AD 2 MAP 1-1`                     | aerodrome chart                                        |
| FR      | href `_ADC_01.pdf` > `_ADC_` > `_APDC_` | aerodrome chart (Cartes/<ICAO>/)                       |
| NL      | href `-VFR-PROC.pdf`                    | visual procedures chart                                |
| UK      | text `AD 2.Exxx-2-1`                    | aerodrome chart                                        |
| BE      | text `-2-1`                             | aerodrome chart (validated live; recon client got 403) |
| CZ      | href `-vfrc.pdf` > `-adc.pdf`           | VFR chart, else aerodrome chart                        |
| NO      | text `AD 2 Exxx 2 - 1`                  | aerodrome chart                                        |
| PL      | first PDF (single link per page)        | the VFR AD chart                                       |
| SE      | href `VAC.pdf`                          | visual approach chart                                  |

**Chart-list stage is implemented too** (12.07.2026, "PDF-Optimierungen 1-4"):
the crawlers store the source's FULL chart list per airport (`airports.charts`,
JSON `{name, url}[]`, capped at 50, names from the source's own designations
with a filename-stem fallback), the chart box renders the primary link plus a
collapsed "all charts" `<details>` list, an honest designation + AIRAC date
line (parsed from the URL, `src/lib/charts.ts` - unit-tested), and the
DigitalDocument JSON-LD carries `datePublished` + the other charts as
`hasPart`. The daily crawl logs per-country `pdf_url coverage` and emits a
GitHub-Actions warning when a country's coverage collapses to 0 (markup
drift); the per-field offline save fetches chart PDFs CORS-first (real size)
before falling back to the opaque no-cors cache entry (quota padding).

**DE has no public chart PDFs** - the BasicVFR chart pages expose zero PDF
links (recon probes on multiple permalinks) - so `pdf_url` stays null for DE
and the site keeps linking the permalink page. The self-hosting path below
stays future scope.

---

## Current state

Per airport we store a single `url` (crawler output, `airports.url`). What it
points at **varies by country/source**:

- Some sources already link **directly to a PDF** (the `url` ends in `.pdf`).
- Others link to an **HTML chart page / eAIP frameset** (e.g. DFS BasicVFR
  permalinks are amendment-stable HTML `pages/CNNNNN.html`; eurocontrol eAIPs are
  HTML nav pages). There is no single PDF behind these without extra parsing.

So a reliable "direct PDF" link exists only where `url` is already a PDF; for the
rest it needs per-country crawler work to capture the PDF URL.

## Two hard constraints

1. **No server-side PDF rendering on Workers.** Cloudflare Workers has no
   Chromium, so we cannot rasterize a PDF to an image server-side. Any preview is
   the browser's own PDF viewer via `<object>`/`<iframe>`.
2. **Cross-origin framing is often blocked.** Many AIP hosts send
   `X-Frame-Options: DENY` / a restrictive CSP `frame-ancestors`, which makes an
   embedded preview show an **empty box**. Preview must therefore be best-effort,
   with a visible fallback to "open in new tab".

---

## Staged approach

### Stage 1 - UI only, where `url` is already a PDF (small, no crawler change)

1. Add a helper `isPdfUrl(url: string): boolean` (`src/lib/utils.ts`) - true when
   the path ends in `.pdf` (case-insensitive, ignoring query/hash).
2. On the detail pages (the `(search)/*` result block, near the existing chart
   link), when `isPdfUrl(airport.url)`:
   - Render an explicit **"Open chart PDF"** link (`ExternalLink`, `rel="noopener"`),
     visually distinct from the current "index page" link.
   - Add an **optional inline preview** in a collapsible `<details>` (SSR, no JS):
     ```tsx
     <details>
       <summary>{t("Chart.preview")}</summary>
       <object
         data={airport.url}
         type="application/pdf"
         class="h-[80vh] w-full"
       >
         {/* fallback shown if the host blocks framing */}
         <ExternalLink href={airport.url}>{t("Chart.openPdf")}</ExternalLink>
       </object>
     </details>
     ```
     The `<object>` fallback content renders when the browser can't embed the PDF
     (blocked framing / unsupported), so there is never a dead empty box.
3. i18n: add `Chart.openPdf`, `Chart.preview` to all 22 locale files.
4. Add the PDF host(s) to the CSP once known (`frame-src`, `object-src` /
   `img-src` as needed) - CSP is currently `Report-Only`, so it won't block, but
   keep it correct for when it is enforced.

**Effort:** S. **Risk:** low. **Caveat:** only fields whose `url` is already a
PDF benefit; preview works only where the host allows framing.

### Stage 2 - capture the PDF URL in the crawlers (per country)

For sources whose `url` is an HTML page, add a dedicated PDF URL so Stage 1's
link/preview works everywhere.

1. **Schema:** add a nullable `pdf_url` (text) to the `airports` table
   (`src/server/db/schema.ts`) + a migration. Keep `url` as the human chart page.
2. **Crawler model:** add `pdf_url: str | None` to `crawlers/crawlers/models.py`
   (`Airport`), and to the API Zod schema (`airportApiInsertSchema`) +
   `/api/airports` ingest.
3. **Per-country extraction:** in each crawler, when the chart page exposes a
   direct PDF (many eAIPs link the PDF from the chart HTML), capture it into
   `pdf_url`. Do this **country by country** - the markup differs per source;
   prefer an amendment-stable URL where one exists (like the DFS permalink
   strategy). Where no stable PDF URL exists, leave `pdf_url` null (Stage 1
   simply falls back to the `url` link).
4. **Display:** prefer `pdf_url` for the "Open PDF" link/preview, else fall back
   to `url` (and `isPdfUrl(url)`).

**Effort:** M-L (spread across countries). **Risk:** medium (per-source
markup). Roll out one country at a time; nothing breaks while `pdf_url` is null.

---

## Decisions needed from the owner

1. **Start with Stage 1 only** (link + preview where `url` is already a PDF)? -
   quick win, no crawler changes.
2. **Inline preview:** enable it (best-effort `<object>` with a visible fallback
   when framing is blocked), or link-only to avoid empty-box confusion?
3. **Stage 2 priority order** - which countries first (e.g. the ones whose `url`
   is HTML today and that have the most traffic)?

Once decided, Stage 1 can ship in one small PR; Stage 2 proceeds per country.
