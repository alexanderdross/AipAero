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
    "ee",
    "ee-EN",
    "fi",
    "fi-EN",
    "es",
    "es-EN",
    "lv",
    "lv-EN",
    "is",
    "is-EN",
    "pt",
    "pt-EN",
    "hu",
    "hu-EN",
    "si",
    "si-EN",
    "lt",
    "lt-EN",
    "rs",
    "rs-EN",
    "ie",
    "sk",
    "sk-EN",
    "ba",
    "ba-EN",
    "ch",
    "ch-EN",
    "al",
    "al-EN",
    "mk",
    "mk-EN",
    "ro",
    "ro-EN",
    "cy",
    "cy-EN",
    "mt",
    "md",
    "md-EN",
    "it",
    "it-EN",
    "hr",
    "hr-EN",
    "bg",
    "bg-EN",
    "tr",
    "tr-EN",
    "ge",
    "ge-EN",
    "am",
    "am-EN",
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
      "ee-EN": "/ee/en",
      "fi-EN": "/fi/en",
      "es-EN": "/es/en",
      "lv-EN": "/lv/en",
      "is-EN": "/is/en",
      "pt-EN": "/pt/en",
      "hu-EN": "/hu/en",
      "si-EN": "/si/en",
      "lt-EN": "/lt/en",
      "rs-EN": "/rs/en",
      "sk-EN": "/sk/en",
      "ba-EN": "/ba/en",
      "ch-EN": "/ch/en",
      "al-EN": "/al/en",
      "mk-EN": "/mk/en",
      "ro-EN": "/ro/en",
      "cy-EN": "/cy/en",
      "md-EN": "/md/en",
      "it-EN": "/it/en",
      "hr-EN": "/hr/en",
      "bg-EN": "/bg/en",
      "tr-EN": "/tr/en",
      "ge-EN": "/ge/en",
      "am-EN": "/am/en",
    },
  },
  pathnames: {
    "/": "/",
    "/terms": "/terms",
    // "EFB" is the term pilots search in every language - one slug for all.
    "/efb": "/efb",
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
      ee: "/lennuvaljade-nimekiri-eesti",
      "ee-EN": "/airport-list-estonia",
      fi: "/lentopaikat-suomi",
      "fi-EN": "/airport-list-finland",
      es: "/lista-de-aeropuertos-espana",
      "es-EN": "/airport-list-spain",
      lv: "/lidlauku-saraksts-latvija",
      "lv-EN": "/airport-list-latvia",
      is: "/flugvallalisti-island",
      "is-EN": "/airport-list-iceland",
      pt: "/lista-de-aerodromos-portugal",
      "pt-EN": "/airport-list-portugal",
      hu: "/repuloterek-listaja-magyarorszag",
      "hu-EN": "/airport-list-hungary",
      si: "/seznam-letalisc-slovenija",
      "si-EN": "/airport-list-slovenia",
      lt: "/oro-uostu-sarasas-lietuva",
      "lt-EN": "/airport-list-lithuania",
      rs: "/lista-aerodroma-srbija",
      "rs-EN": "/airport-list-serbia",
      ie: "/airport-list-ireland",
      sk: "/letiska-slovensko",
      "sk-EN": "/airport-list-slovakia",
      ba: "/lista-aerodroma-bih",
      "ba-EN": "/airport-list-bosnia",
      ch: "/flugplaetze-schweiz",
      "ch-EN": "/airport-list-switzerland",
      al: "/aeroportet-shqiperi",
      "al-EN": "/airport-list-albania",
      mk: "/aerodromi-severna-makedonija",
      "mk-EN": "/airport-list-north-macedonia",
      ro: "/lista-aeroporturi-romania",
      "ro-EN": "/airport-list-romania",
      cy: "/aerolimenes-kypros",
      "cy-EN": "/airport-list-cyprus",
      mt: "/airport-list-malta",
      md: "/lista-aeroporturi-moldova",
      "md-EN": "/airport-list-moldova",
      it: "/elenco-aeroporti-italia",
      "it-EN": "/airport-list-italy",
      hr: "/popis-zracnih-luka-hrvatska",
      "hr-EN": "/airport-list-croatia",
      bg: "/letishta-balgariya",
      "bg-EN": "/airport-list-bulgaria",
      tr: "/havalimanlari-turkiye",
      "tr-EN": "/airport-list-turkey",
      ge: "/aeroportebi-sakartvelo",
      "ge-EN": "/airport-list-georgia",
      am: "/odanavakayanner-hayastan",
      "am-EN": "/airport-list-armenia",
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
  ee: "et",
  "ee-EN": "en",
  fi: "fi",
  "fi-EN": "en",
  es: "es",
  "es-EN": "en",
  lv: "lv",
  "lv-EN": "en",
  is: "is",
  "is-EN": "en",
  pt: "pt",
  "pt-EN": "en",
  hu: "hu",
  "hu-EN": "en",
  // Slovenia: prefix "si", ISO language code "sl" (the LocaleSwitcher ICU
  // branches key on the PREFIX - see the gotcha in CLAUDE.md).
  si: "sl",
  "si-EN": "en",
  // Lithuania: prefix "lt" == ISO language code "lt", so the LocaleSwitcher
  // ICU branch keys match without the si/cz/dk/gr caveat.
  lt: "lt",
  "lt-EN": "en",
  // Serbia: prefix "rs", ISO language code "sr" (the LocaleSwitcher ICU
  // branches key on the PREFIX "rs" - see the gotcha in CLAUDE.md).
  rs: "sr",
  "rs-EN": "en",
  // Ireland: single English locale (like uk/be) - the AIP and site content
  // are English only, so no `ie-EN` twin.
  ie: "en",
  // Slovakia: prefix "sk" == ISO language code "sk", so the LocaleSwitcher ICU
  // branch keys match without the si/cz/dk/gr caveat.
  sk: "sk",
  "sk-EN": "en",
  // Bosnia and Herzegovina: prefix "ba", ISO language code "bs" (Bosnian) -
  // the LocaleSwitcher ICU branches key on the PREFIX "ba" (see the gotcha in
  // CLAUDE.md), so messages/ba.json keys its native branch on "ba".
  ba: "bs",
  "ba-EN": "en",
  // Switzerland: prefix "ch", native language German (`de`) like Austria (CH
  // is multilingual; German is the majority language). The LocaleSwitcher ICU
  // branch keys on the PREFIX "ch" (see the gotcha in CLAUDE.md).
  ch: "de",
  "ch-EN": "en",
  // Albania: prefix "al", ISO language code "sq" (Albanian) - the
  // LocaleSwitcher ICU branches key on the PREFIX "al" (see the gotcha in
  // CLAUDE.md), so messages/al.json keys its native branch on "al".
  al: "sq",
  "al-EN": "en",
  // North Macedonia: prefix "mk" == ISO language code "mk" (Macedonian), so
  // the LocaleSwitcher ICU branch keys match without the si/cz/dk/gr caveat.
  mk: "mk",
  "mk-EN": "en",
  // Romania: prefix "ro" == ISO language code "ro" (Romanian), so the
  // LocaleSwitcher ICU branch keys match without the si/cz/dk/gr caveat.
  ro: "ro",
  "ro-EN": "en",
  // Cyprus: prefix "cy", ISO language code "el" (Greek) - the LocaleSwitcher
  // ICU branches key on the PREFIX "cy" (see the gotcha in CLAUDE.md), so
  // messages/cy.json keys its native branch on "cy".
  cy: "el",
  "cy-EN": "en",
  // Malta: single English locale (like uk/ie/be) - Malta is bilingual but
  // English is co-official and the aviation language, so no `mt-EN` twin.
  mt: "en",
  // Moldova: prefix "md", ISO language code "ro" (Moldovan is Romanian) - the
  // LocaleSwitcher ICU branches key on the PREFIX "md" (see the gotcha in
  // CLAUDE.md), so messages/md.json keys its native branch on "md".
  md: "ro",
  "md-EN": "en",
  // Italy: prefix "it" == ISO language code "it" (Italian), so the
  // LocaleSwitcher ICU branch keys match without the si/cz/dk/gr caveat.
  it: "it",
  "it-EN": "en",
  // Croatia: prefix "hr" == ISO language code "hr" (Croatian), so the
  // LocaleSwitcher ICU branch keys match without the si/cz/dk/gr caveat.
  hr: "hr",
  "hr-EN": "en",
  // Bulgaria: prefix "bg" == ISO language code "bg" (Bulgarian), so the
  // LocaleSwitcher ICU branch keys match without the si/cz/dk/gr caveat.
  bg: "bg",
  "bg-EN": "en",
  // Turkey: prefix "tr" == ISO language code "tr" (Turkish), so the
  // LocaleSwitcher ICU branch keys match without the si/cz/dk/gr caveat.
  tr: "tr",
  "tr-EN": "en",
  // Georgia: prefix "ge", ISO language code "ka" (Georgian) - the
  // LocaleSwitcher ICU branches key on the PREFIX "ge" (see the gotcha in
  // CLAUDE.md), so messages/ge.json keys its native branch on "ge"; the
  // hreflang uses "ka".
  ge: "ka",
  "ge-EN": "en",
  // Armenia: prefix "am", ISO language code "hy" (Armenian) - the
  // LocaleSwitcher ICU branches key on the PREFIX "am" (see the gotcha in
  // CLAUDE.md), so messages/am.json keys its native branch on "am"; the
  // hreflang uses "hy".
  am: "hy",
  "am-EN": "en",
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
  ee: "ee",
  "ee-EN": "ee",
  fi: "fi",
  "fi-EN": "fi",
  es: "es",
  "es-EN": "es",
  lv: "lv",
  "lv-EN": "lv",
  is: "is",
  "is-EN": "is",
  pt: "pt",
  "pt-EN": "pt",
  hu: "hu",
  "hu-EN": "hu",
  si: "si",
  "si-EN": "si",
  lt: "lt",
  "lt-EN": "lt",
  rs: "rs",
  "rs-EN": "rs",
  ie: "ie",
  sk: "sk",
  "sk-EN": "sk",
  ba: "ba",
  "ba-EN": "ba",
  ch: "ch",
  "ch-EN": "ch",
  al: "al",
  "al-EN": "al",
  mk: "mk",
  "mk-EN": "mk",
  ro: "ro",
  "ro-EN": "ro",
  cy: "cy",
  "cy-EN": "cy",
  mt: "mt",
  md: "md",
  "md-EN": "md",
  it: "it",
  "it-EN": "it",
  hr: "hr",
  "hr-EN": "hr",
  bg: "bg",
  "bg-EN": "bg",
  tr: "tr",
  "tr-EN": "tr",
  ge: "ge",
  "ge-EN": "ge",
  am: "am",
  "am-EN": "am",
};
