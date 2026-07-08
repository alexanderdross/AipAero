import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type routing } from "~/i18n/routing";
import { type Airport } from "~/server/db/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
// fully wired (routes, translations, crawlers) but hidden, so launching one is
// just un-commenting its line here and its card in `src/app/page.tsx` once its
// crawler has been validated against the live AIP source.
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
