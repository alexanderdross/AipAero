import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: [
    "at",
    "at-EN",
    "de",
    "de-EN",
    "fr",
    "fr-EN",
    "nl",
    "nl-EN",
    "uk",
    "be",
    "cz",
    "cz-EN",
    "dk",
    "dk-EN",
    "gr",
    "gr-EN",
    "no",
    "no-EN",
    "pl",
    "pl-EN",
    "se",
    "se-EN",
  ],
  defaultLocale: "uk",
  localePrefix: {
    mode: "always",
    prefixes: {
      "at-EN": "/at/en",
      "de-EN": "/de/en",
      "fr-EN": "/fr/en",
      "nl-EN": "/nl/en",
      "cz-EN": "/cz/en",
      "dk-EN": "/dk/en",
      "gr-EN": "/gr/en",
      "no-EN": "/no/en",
      "pl-EN": "/pl/en",
      "se-EN": "/se/en",
    },
  },
  pathnames: {
    "/": "/",
    "/terms": "/terms",
    "/vfr": "/vfr",
    "/ifr": "/ifr",
    "/heliports": "/heliports",
    "/military": "/military",
    "/aeroports": "/aeroports",
    "/airport-list": {
      at: "/flughafen-liste-oesterreich",
      "at-EN": "/airport-list-austria",
      de: "/flughafen-liste-deutschland",
      "de-EN": "/airport-list-germany",
      fr: "/liste-des-aeroports-francais",
      "fr-EN": "/airport-list-france",
      nl: "/luchthavenlijst-nederland",
      "nl-EN": "/airport-list-netherlands",
      uk: "/airport-list-uk",
      be: "/airport-list-belgium",
      cz: "/letiste-cesko",
      "cz-EN": "/airport-list-czechia",
      dk: "/flyvepladser-danmark",
      "dk-EN": "/airport-list-denmark",
      gr: "/aerolimenes-ellada",
      "gr-EN": "/airport-list-greece",
      no: "/flyplasser-norge",
      "no-EN": "/airport-list-norway",
      pl: "/lotniska-polska",
      "pl-EN": "/airport-list-poland",
      se: "/flygplatser-sverige",
      "se-EN": "/airport-list-sweden",
    },
  },
  localeCookie: false,
  localeDetection: true,
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export const { Link, getPathname, redirect, usePathname, useRouter } =
  createNavigation(routing);

/**
 * A country is single-locale when routing has no `<cc>-EN` partner for it
 * (currently `uk` and `be`): only one language is ever served, so it needs no
 * language switcher and no alternate-language hreflang / sitemap links. Derived
 * from the routing config so a newly added single-language country (an English
 * locale with no `-EN` sibling) is handled automatically.
 */
export function isSingleLocale(locale: string): boolean {
  const native = locale.replace("-EN", "");
  return !(routing.locales as readonly string[]).includes(native + "-EN");
}

export const localeLangMapping: Record<
  (typeof routing.locales)[number] | string,
  string
> = {
  at: "de",
  "at-EN": "en",
  de: "de",
  "de-EN": "en",
  fr: "fr",
  "fr-EN": "en",
  nl: "nl",
  "nl-EN": "en",
  uk: "en",
  be: "en",
  cz: "cs",
  "cz-EN": "en",
  dk: "da",
  "dk-EN": "en",
  gr: "el",
  "gr-EN": "en",
  no: "nb",
  "no-EN": "en",
  pl: "pl",
  "pl-EN": "en",
  se: "sv",
  "se-EN": "en",
};

export const localeCountryMapping: Record<
  (typeof routing.locales)[number] | string,
  string
> = {
  at: "at",
  "at-EN": "at",
  de: "de",
  "de-EN": "de",
  fr: "fr",
  "fr-EN": "fr",
  nl: "nl",
  "nl-EN": "nl",
  uk: "uk",
  be: "be",
  cz: "cz",
  "cz-EN": "cz",
  dk: "dk",
  "dk-EN": "dk",
  gr: "gr",
  "gr-EN": "gr",
  no: "no",
  "no-EN": "no",
  pl: "pl",
  "pl-EN": "pl",
  se: "se",
  "se-EN": "se",
};
