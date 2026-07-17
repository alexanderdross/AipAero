import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type routing } from "~/i18n/routing";
import { type Airport } from "~/server/db/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when the URL points directly at a PDF (path ends in `.pdf`). */
export function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return /\.pdf(?:[?#]|$)/i.test(url);
  }
}

/**
 * URL-safe anchor slug of a country's English name ("Belgium & Luxembourg"
 * -> "belgium-luxembourg"). Used for the homepage card anchors (/#germany),
 * the A-Z jump bar and the /germany short-URL redirects in middleware.ts.
 */
export function countryAnchorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const orgUrl = new URL("https://aip.aero/");
export const orgLogoUrl = new URL("/aip-logo-446x319.jpg", orgUrl);
export const orgLogoSquareUrl = new URL("/aip-logo-450x450.jpg", orgUrl);
export const rootTitle =
  "Free AIP and Approach Charts for VFR, IFR & Heliports";
export const rootDescription =
  "Open Library for Aeronautical Information Publication (AIP) for VFR, IFR & Heliports.";
export const rootBreadcrumb = {
  "@type": "ListItem",
  position: 1,
  item: {
    "@id": orgUrl.toString(),
    name: "AIP:Aero",
    alternateName: rootTitle,
    description: rootDescription,
  },
};
export const i18nPathMapping: Record<
  Airport["type"],
  keyof (typeof routing)["pathnames"]
> = {
  vfr: "/vfr",
  ifr: "/ifr",
  heliport: "/heliports",
  mil: "/military",
  aeroport: "/aeroports",
};

// Which airport types (and therefore which search pages / country cards /
// sitemap entries) each country exposes. Keyed by the two-letter country code
// (`localeCountryMapping[locale]`). This is the single source of truth for
// per-country page availability - the search pages' `generateStaticParams`,
// the country landing cards, the menus and the sitemap all derive from it, so
// adding a country is a one-line change here plus its translations + crawler.
export const countryTypeAvailability: Record<string, Airport["type"][]> = {
  at: ["vfr", "heliport"],
  de: ["vfr", "ifr", "heliport"],
  fr: ["aeroport", "mil"],
  nl: ["vfr", "heliport"],
  uk: ["vfr", "heliport"],
  be: ["vfr", "ifr", "heliport", "mil"],
  // CZ eAIP carries only IFR aerodromes; the VFR aerodromes + SLZ ultralight
  // fields (both "vfr") come from the separate ANS CR VFR Manual, harvested
  // by the CZ crawler. (The manual's heliports are skipped for now - they
  // would need a /cz/heliports page + HeliportPage i18n.)
  cz: ["vfr", "ifr"],
  dk: ["vfr", "heliport"],
  gr: ["vfr", "heliport"],
  no: ["vfr", "heliport"],
  pl: ["vfr", "heliport"],
  se: ["vfr", "heliport"],
  ee: ["vfr", "heliport"],
  fi: ["vfr", "heliport"],
  // ES: the ENAIRE crawler covers the AD-2 aerodrome list only (type
  // "vfr"); heliports are not part of the crawled AIP section.
  es: ["vfr"],
  lv: ["vfr", "heliport"],
  // IS/HU eAIPs carry no AD-3 heliport chapters (run 29265643933) - vfr only.
  is: ["vfr"],
  // PT: the eAIP has VFR aerodromes only, but the separate eVFR Manual
  // (merged by the PT crawler) adds 20 more VFR aerodromes AND ~44 heliports
  // (hospital helipads etc., AD-3), so PT now has a heliports page too.
  pt: ["vfr", "heliport"],
  hu: ["vfr"],
  si: ["vfr"],
  // LT: the ANS eAIP crawler covers the AD-2 aerodrome list (type "vfr");
  // Lithuania's four international aerodromes, no AD-3 heliport chapter.
  lt: ["vfr"],
  // RS: the SMATSA public VFR AIP lists aerodromes AND helidromes as one
  // AD-2 set (~35 fields); the crawler classifies them all as "vfr".
  rs: ["vfr"],
  // IE: AirNav Ireland's eAIP lists AD-2 aerodromes only (22 fields, type
  // "vfr"); there is no AD-3 heliport chapter.
  ie: ["vfr"],
  // SK: the LPS SR eAIP lists AD-2 aerodromes only (5 international fields,
  // type "vfr"); there is no AD-3 heliport chapter.
  sk: ["vfr"],
  // BA: BHANSA's eAIP lists AD 2 (4 international aerodromes) + AD 4 (the
  // small VFR fields), all "vfr"; there is no AD-3 heliport chapter.
  ba: ["vfr"],
  // CH: info-page only (skybriefing charts are paywalled). The aerodrome list
  // comes from OurAirports; each field is "vfr" with OpenAIP data + weather and
  // a blue AIP button to the skybriefing portal (no chart crawl).
  ch: ["vfr"],
  // AL: Albcontrol's eAIP lists the 2 international aerodromes (LATI/LAKU),
  // all "vfr"; there is no AD-3 heliport chapter.
  al: ["vfr"],
  // MK: M-NAV's eAIP lists the 2 international aerodromes (LWSK/LWOH), all
  // "vfr" (each field's AD 2 chart PDF); the single AD 3 doc is not split.
  mk: ["vfr"],
  // RO: AISRO's eAIP lists the Romanian aerodromes (LR**), all "vfr" (each
  // field's AD 2 chart PDF from the static DOCS tree).
  ro: ["vfr"],
  // CY: DCA Cyprus "Open Cyprus VFR Manual" lists the 2 civil aerodromes
  // (LCLK Larnaka / LCPH Pafos), all "vfr" (each field's VFR chart PDF).
  cy: ["vfr"],
  // MT: info-page only (the MATS AIP portal is a JS app, no open chart tree).
  // OurAirports aerodrome list, "vfr", OpenAIP data + weather + AIP button.
  mt: ["vfr"],
  // MD: info-page only (the MOLDATSA AIM portal is registration-gated).
  // OurAirports aerodrome list, "vfr", OpenAIP data + weather + AIP button.
  md: ["vfr"],
  // IT: info-page only (ENAV Self Briefing is login-only, no open eAIP).
  // OurAirports aerodrome list, "vfr", OpenAIP data + weather + AIP button.
  it: ["vfr"],
  // HR: info-page only (Crocontrol moved to the subscription AIM Portal on
  // 01.01.2026). OurAirports aerodrome list, "vfr", OpenAIP data + weather.
  hr: ["vfr"],
  // BG: info-page only (BULATSA's b-flip AIP portal is registration-gated).
  // OurAirports aerodrome list, "vfr", OpenAIP data + weather + AIP button.
  bg: ["vfr"],
};

/**
 * Countries whose official AIP / charts sit behind a login or paid
 * registration, so we deliberately do NOT crawl charts and instead link the
 * provider's portal (the airport `url`). The detail page shows a
 * "registration may be required" hint next to the AIP button. Keyed by the
 * two-letter country code (`localeCountryMapping[locale]`).
 */
export const gatedCountries = new Set<string>([
  "ch",
  "mt",
  "md",
  "it",
  "hr",
  "bg",
]);

/** True if `country` (two-letter code) links a gated (login/paywall) AIP portal. */
export function isGatedCountry(country: string): boolean {
  // Normalize case: the DB stores country codes uppercase ("CH"), while
  // gatedCountries + locale-derived callers use lowercase ("ch").
  return gatedCountries.has(country.toLowerCase());
}

/**
 * Countries whose official AIP is a self-service HTML portal from which the
 * pilot generates the chart PDF themselves (DE: DFS BasicVFR / BasicIFR), so
 * the detail-page "no separate chart PDF is published" note would be
 * misleading - the chart IS available, just exported on demand - and is
 * suppressed for these. Keyed by the two-letter code (case-insensitive).
 */
export const selfServicePdfCountries = new Set<string>(["de"]);

/** True if `country` publishes its charts via a self-service PDF export (DE/DFS). */
export function isSelfServicePdfCountry(country: string): boolean {
  return selfServicePdfCountries.has(country.toLowerCase());
}

/**
 * SERP `<title>` decorator (CTR): prefixes an aircraft emoji - a helicopter for
 * heliport pages - and appends a `✔️` "hook" suffix. These emojis live ONLY in
 * the metadata `<title>` (which Next.js mirrors into og:title / twitter:title)
 * and in the Product JSON-LD `name`; never in the visible on-page heading -
 * callers pass the same UNDECORATED text to `<Title>`/`<Hero>`. The message JSON
 * carries no emoji, so this is the single source of truth. Multi-type pages
 * (country landing, airport-list) are aggregate and pass no type -> aircraft.
 */
export function serpTitle(
  text: string,
  opts?: { type?: Airport["type"] },
): string {
  const emoji = opts?.type === "heliport" ? "🚁" : "🛩️";
  return `${emoji} ${text}✔️`;
}

/** True if `country` (two-letter code) exposes the given search page type. */
export function countryHasType(
  country: string,
  type: Airport["type"],
): boolean {
  return countryTypeAvailability[country]?.includes(type) ?? false;
}

/** Chart-availability bucket for a country (drives the airport-list note). */
export type ChartCoverageBucket = "gated" | "full" | "partial" | "none";

/**
 * Chart-availability signal for a country, derived from the airport rows the
 * list page already loaded (`QUERIES.airportsByCountry`) - so it costs no extra
 * query and can never drift from the real data. Feeds the honest "what you get"
 * note on the airport-list page:
 *
 *  - "gated":   login/registration AIP portal, no chart crawl (ch/mt/md).
 *  - "full":    every field has a direct chart PDF.
 *  - "partial": some fields have a chart PDF, the rest link their AIP entry.
 *  - "none":    no field has a chart PDF (the authority publishes none, e.g. the
 *               DE DFS BasicVFR HTML AIP), so the links open the AIP pages.
 */
export function chartCoverage(
  country: string,
  airports: Pick<Airport, "url" | "pdfUrl">[],
): { bucket: ChartCoverageBucket; withCharts: number; total: number } {
  const total = airports.length;
  if (isGatedCountry(country)) return { bucket: "gated", withCharts: 0, total };
  const withCharts = airports.filter(
    (a) => a.pdfUrl != null || isPdfUrl(a.url),
  ).length;
  const bucket: ChartCoverageBucket =
    withCharts === 0 ? "none" : withCharts === total ? "full" : "partial";
  return { bucket, withCharts, total };
}

// Countries whose crawler is verified and feeding airport data. Only these are
// promoted on the start page and listed in the sitemap index; the others stay
// fully wired (routes, translations, crawlers, COUNTRY_META) but hidden, so
// launching one is just un-commenting its line here once its crawler has been
// validated against the live AIP source.
export const liveCountries: string[] = [
  "at",
  "de",
  "fr",
  "nl",
  "uk",
  // Verified via the live-crawl test (PR #122): crawler delivers data.
  "be",
  "cz",
  "no",
  "pl",
  "se",
  // Europe expansion batch 1 (13.07.2026): crawlers live-validated
  // (runs 29257033060/29257457290/29258501240/29265643933), first data
  // published via the manual crawl dispatch on launch day.
  "ee",
  "fi",
  "es",
  "lv",
  "is",
  "pt",
  "hu",
  // Slovenia (13.07.2026): crawler live-validated (run 29272420058,
  // 4 airports) behind the pinned-intermediate TLS fix; first data
  // published via the manual crawl dispatch on launch day.
  "si",
  // Denmark (14.07.2026): crawler rewritten onto the Naviair Umbraco JSON
  // API and live-validated (run 29291960740 - 35 airports incl. the
  // EKRB/EKRH hospital heliports, 100% chart coverage); first data
  // published via the manual crawl dispatch on launch day.
  "dk",
  // Lithuania (14.07.2026): custom ANS eAIP crawler via the Bright Data Web
  // Unlocker (ans.lt WAFs datacenter IPs), edition auto-resolved,
  // live-validated (run 29319... - 4 aerodromes EYKA/EYPA/EYSA/EYVI, 4/4 VAC
  // chart coverage); first data published via the manual crawl dispatch on
  // launch day.
  "lt",
  // Serbia (14.07.2026): SMATSA public VFR AIP (the IFR eAIP is paywalled).
  // The AD page is JS-rendered, so the crawler uses PlaywrightCrawlerBase
  // (like DK); live-validated (run 29325083251 - 35 aerodromes, 35/35 chart
  // PDF coverage, 99 charts), names from the AD 1.3 index. The joint
  // Serbia/Montenegro AIP includes a few Montenegrin fields. First data
  // published via the manual crawl dispatch on launch day.
  "rs",
  // Ireland (15.07.2026): AirNav Ireland (formerly IAA) publishes an open
  // eurocontrol eAIP on www.airnav.ie (the old iaip.iaa.ie host is retired).
  // Per-chapter AD-2 crawler, edition auto-resolved from the AIM landing page;
  // live-validated (run 29441545116 - 22 aerodromes, 9/22 chart-PDF coverage,
  // the major fields; small GA fields carry a text AD entry only). First data
  // published to production D1 via the manual crawl dispatch (22 rows).
  "ie",
  // Slovakia (15.07.2026): the LPS SR AIS portal (aim.lps.sk) is session-based
  // PHP, but its AIP SR page publicly links the currently effective eAIP - a
  // standard eurocontrol frameset (LZ-frameset-en-SK.html) - with no login.
  // Crawler resolves the "Currently Effective" edition, then AD-2;
  // live-validated (run 29443130839 - 5 international aerodromes, 5/5 chart-PDF
  // coverage, 101 charts). First data published to production D1 (5 rows).
  "sk",
  // Greece (15.07.2026): HASP's main.php landing is captcha-gated and Bright
  // Data blocks the .gov page, but each AIRAC edition is a STATIC tree whose
  // deep paths proxy through at 200. The crawler derives the current edition
  // from the AIRAC schedule (probing the static folders, no main.php) and reads
  // AIP-menu.htm for AD 2 aerodrome + AD 3 heliport chart PDFs. Live-validated
  // (run 29446360729 - 41 aerodromes + 45 heliports, 100% chart coverage). First
  // data published to production D1 (86 rows).
  "gr",
  // Bosnia and Herzegovina (15.07.2026): BHANSA publishes a standard
  // eurocontrol eAIP at eaip.bhansa.gov.ba. The edition folder is date-stamped
  // (<YYYY-MM-DD>-AIRAC), so the crawler derives the current edition from the
  // AIRAC schedule (no JS root), then reads the per-airport AD 2 (4
  // international aerodromes) + AD 4 (small VFR fields) chapters, all "vfr".
  // Live-validated (run 29448132449 - 17 aerodromes, 4/17 chart-PDF coverage,
  // the 4 international fields; the AD-4 VFR fields carry a text AD entry only).
  // First data published to production D1 via the manual crawl dispatch.
  "ba",
  // Switzerland (15.07.2026): info-page only - skybriefing (skyguide) publishes
  // the official Swiss AIP + charts behind a login/registration, so we do NOT
  // crawl charts. The aerodrome list comes from OurAirports; each field is a
  // "vfr" row with OpenAIP data + weather and a blue AIP button to the
  // skybriefing portal (https://www.skybriefing.com/en/aip, verified 200 via
  // the live-test check_urls). Gated (see gatedCountries): the detail page
  // shows a "registration may be required" hint. Live-validated (run
  // 29449399452 - 67 aerodromes, 0 charts by design). First data published to
  // production D1 via the manual crawl dispatch.
  "ch",
  // Albania (15.07.2026): Albcontrol publishes a standard eurocontrol eAIP
  // linked from www.albcontrol.al/aip/ (dated editions). The crawler resolves
  // the effective edition by date, fetches the LA-menu-en-GB.html nav frame
  // directly, and reads the AD 2 aerodromes (LATI Tirana, LAKU Kukes) - the
  // country's complete international set. Live-validated (run 29453417634 -
  // 2 aerodromes, 2/2 chart-PDF coverage, 25 charts). First data published to
  // production D1 via the manual crawl dispatch.
  "al",
  // North Macedonia (16.07.2026): M-NAV publishes an open eAIP at
  // ais.m-nav.info/eAIP/ (the "current" alias resolves the edition). Its older
  // custom generator has no static per-field HTML, but each aerodrome's full
  // AD 2 doc is a combined PDF under pdf/aerodromes/ (LW_AD_2_<ICAO>_en.pdf);
  // mk.py reads the no-JS nav for the 2 international fields (LWSK Skopje, LWOH
  // Ohrid) and points each at that chart PDF. Live-validated (2 aerodromes,
  // 2/2 chart-PDF coverage). First data published via the manual crawl dispatch.
  "mk",
  // Romania (16.07.2026): AISRO's landing (aisro.ro/aip/aip.php) links the
  // effective edition /aip/<date>/index.html; each edition is a static tree
  // with a browsable DOCS/AIP/AD/AD2/ directory (Greece pattern). ro.py sends
  // browser headers (the host gates plain UAs), resolves the edition by date,
  // lists AD2 to enumerate every aerodrome (35 fields, LR**), and points each
  // at its combined AD 2 chart PDF; names from a static AD 1.3-derived map.
  // First data published via the manual crawl dispatch.
  "ro",
  // Cyprus (16.07.2026): DCA Cyprus publishes an open, static "Open Cyprus VFR
  // Manual" at vfrmanual.dca.mcw.gov.cy. cy.py reads menu.html for each civil
  // aerodrome's charts/VFR_CHART_<ICAO>.pdf (Larnaka LCLK, Pafos LCPH); the
  // country-wide LCCC sheet is excluded. Live-validated (run 29489284966 -
  // 2 aerodromes, 2/2 chart-PDF coverage). First data published via the manual
  // crawl dispatch. NOT gated (open chart source).
  "cy",
  // Malta (16.07.2026): info-page. The MATS AIP portal (maltats.com/aim) is a
  // JavaScript app with no open chart tree, so - like CH - no chart crawl:
  // mt.py reads the Maltese aerodromes from OurAirports and points each at the
  // Transport Malta AIP page (gated - see gatedCountries). OpenAIP data +
  // weather come from the website. Live-validated (run 29490801719 - 1 field
  // LMML). First data published via the manual crawl dispatch.
  "mt",
  // Moldova (16.07.2026): info-page. The MOLDATSA AIM portal (aim.moldatsa.md)
  // is Home-Briefing-registration-gated with no open chart tree, so - like CH -
  // no chart crawl: md.py reads the Moldovan aerodromes from OurAirports and
  // points each at the AIM portal (gated - see gatedCountries). OpenAIP data +
  // weather come from the website. Live-validated (run 29490801719 - 5 fields,
  // LUKK Chisinau + others). First data published via the manual crawl dispatch.
  "md",
  // Italy (17.07.2026): info-page. ENAV's AIP + charts are behind the login-only
  // Self Briefing portal (no open eAIP - www.enav.it/eAIP/ 404s, aip.enav.it no
  // DNS), so - like CH/MT/MD - no chart crawl: it.py reads the Italian aerodromes
  // from OurAirports and points each at the ENAV Self Briefing portal (gated -
  // see gatedCountries). OpenAIP data + weather come from the website.
  "it",
  // Croatia (17.07.2026): info-page. Croatia Control moved its AIP + charts fully
  // behind the subscription AIM Portal on 01.01.2026 (the former public static
  // eAIP tree now 404s, re-probed 16.07.2026), so - like CH/MT/MD - no chart
  // crawl: hr.py reads the Croatian aerodromes from OurAirports and points each
  // at the AIM Portal (gated). OpenAIP data + weather come from the website.
  "hr",
  // Bulgaria (17.07.2026): info-page. BULATSA's AIP is behind the registration-
  // gated b-flip portal (no open AD-2 tree, re-probed 16.07.2026), so - like
  // CH/MT/MD - no chart crawl: bg.py reads the Bulgarian aerodromes from
  // OurAirports and points each at the b-flip portal (gated). OpenAIP data +
  // weather come from the website.
  "bg",
];

// English-facing display metadata per country, keyed by the two-letter code.
// The global homepage (src/app/page.tsx) derives its country cards, hreflang
// links and about-text links from `liveCountries` x this map - so launching a
// country never needs an edit there. `lang` is the hreflang ISO code of the
// country's native locale (see `localeLangMapping` in routing.ts);
// `nativeLang` is the English NAME of that language for the card buttons.
// Whether a country has an English twin locale comes from `isSingleLocale()`
// in routing.ts - not duplicated here.
export const countryMeta: Record<
  string,
  { lang: string; name: string; flag: string; nativeLang: string }
> = {
  uk: { lang: "en", name: "United Kingdom", flag: "🇬🇧", nativeLang: "English" },
  de: { lang: "de", name: "Germany", flag: "🇩🇪", nativeLang: "German" },
  fr: { lang: "fr", name: "France", flag: "🇫🇷", nativeLang: "French" },
  nl: { lang: "nl", name: "Netherlands", flag: "🇳🇱", nativeLang: "Dutch" },
  at: { lang: "de", name: "Austria", flag: "🇦🇹", nativeLang: "German" },
  be: {
    lang: "en",
    name: "Belgium & Luxembourg",
    flag: "🇧🇪",
    nativeLang: "English",
  },
  cz: { lang: "cs", name: "Czechia", flag: "🇨🇿", nativeLang: "Czech" },
  dk: { lang: "da", name: "Denmark", flag: "🇩🇰", nativeLang: "Danish" },
  gr: { lang: "el", name: "Greece", flag: "🇬🇷", nativeLang: "Greek" },
  no: { lang: "no", name: "Norway", flag: "🇳🇴", nativeLang: "Norwegian" },
  pl: { lang: "pl", name: "Poland", flag: "🇵🇱", nativeLang: "Polish" },
  se: { lang: "sv", name: "Sweden", flag: "🇸🇪", nativeLang: "Swedish" },
  ee: { lang: "et", name: "Estonia", flag: "🇪🇪", nativeLang: "Estonian" },
  fi: { lang: "fi", name: "Finland", flag: "🇫🇮", nativeLang: "Finnish" },
  es: { lang: "es", name: "Spain", flag: "🇪🇸", nativeLang: "Spanish" },
  lv: { lang: "lv", name: "Latvia", flag: "🇱🇻", nativeLang: "Latvian" },
  is: { lang: "is", name: "Iceland", flag: "🇮🇸", nativeLang: "Icelandic" },
  pt: { lang: "pt", name: "Portugal", flag: "🇵🇹", nativeLang: "Portuguese" },
  hu: { lang: "hu", name: "Hungary", flag: "🇭🇺", nativeLang: "Hungarian" },
  si: { lang: "sl", name: "Slovenia", flag: "🇸🇮", nativeLang: "Slovenian" },
  lt: { lang: "lt", name: "Lithuania", flag: "🇱🇹", nativeLang: "Lithuanian" },
  rs: { lang: "sr", name: "Serbia", flag: "🇷🇸", nativeLang: "Serbian" },
  ie: { lang: "en", name: "Ireland", flag: "🇮🇪", nativeLang: "English" },
  sk: { lang: "sk", name: "Slovakia", flag: "🇸🇰", nativeLang: "Slovak" },
  ba: {
    lang: "bs",
    name: "Bosnia and Herzegovina",
    flag: "🇧🇦",
    nativeLang: "Bosnian",
  },
  ch: { lang: "de", name: "Switzerland", flag: "🇨🇭", nativeLang: "German" },
  al: { lang: "sq", name: "Albania", flag: "🇦🇱", nativeLang: "Albanian" },
  mk: {
    lang: "mk",
    name: "North Macedonia",
    flag: "🇲🇰",
    nativeLang: "Macedonian",
  },
  ro: { lang: "ro", name: "Romania", flag: "🇷🇴", nativeLang: "Romanian" },
  cy: { lang: "el", name: "Cyprus", flag: "🇨🇾", nativeLang: "Greek" },
  mt: { lang: "en", name: "Malta", flag: "🇲🇹", nativeLang: "English" },
  md: { lang: "ro", name: "Moldova", flag: "🇲🇩", nativeLang: "Romanian" },
  it: { lang: "it", name: "Italy", flag: "🇮🇹", nativeLang: "Italian" },
  hr: { lang: "hr", name: "Croatia", flag: "🇭🇷", nativeLang: "Croatian" },
  bg: { lang: "bg", name: "Bulgaria", flag: "🇧🇬", nativeLang: "Bulgarian" },
};
