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
  // FI: AD 2 aerodromes only. The Fintraffic AD 3 heliport menu does not
  // expose clean names (came through as the "AD 3.23 ... KARTAT" chart
  // heading), so heliports are not crawled - see fi.py.
  fi: ["vfr"],
  // ES: the ENAIRE crawler covers the AD-2 aerodrome list only (type
  // "vfr"); heliports are not part of the crawled AIP section.
  es: ["vfr"],
  lv: ["vfr", "heliport"],
  // IS/PT/HU crawlers found no AD-3 heliport chapters on the live
  // sources (run 29265643933) - vfr only, like ES.
  is: ["vfr"],
  pt: ["vfr"],
  hu: ["vfr"],
  si: ["vfr"],
  // LT: the ANS eAIP crawler covers the AD-2 aerodrome list (type "vfr");
  // Lithuania's four international aerodromes, no AD-3 heliport chapter.
  lt: ["vfr"],
  // RS: the SMATSA public VFR AIP lists aerodromes AND helidromes as one
  // AD-2 set (~35 fields); the crawler classifies them all as "vfr".
  rs: ["vfr"],
};

/** True if `country` (two-letter code) exposes the given search page type. */
export function countryHasType(
  country: string,
  type: Airport["type"],
): boolean {
  return countryTypeAvailability[country]?.includes(type) ?? false;
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
  // TEMPORARILY HIDDEN - crawler not yet verified against the live source
  // (HASP rejects even the Web Unlocker, see crawlers/recon/):
  // "gr",
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
};
