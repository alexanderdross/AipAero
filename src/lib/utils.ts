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
  cz: ["ifr"],
  dk: ["vfr", "heliport"],
  gr: ["vfr", "heliport"],
  no: ["vfr", "heliport"],
  pl: ["vfr", "heliport"],
  se: ["vfr", "heliport"],
  ee: ["vfr", "heliport"],
  fi: ["vfr", "heliport"],
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
  // TEMPORARILY HIDDEN - crawler not yet verified against the live source:
  // "dk",
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
};
