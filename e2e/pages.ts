// The set of indexable pages under test, mirroring the country/page
// availability matrix and localized pathnames in `src/i18n/routing.ts` and
// CLAUDE.md. Kept as a plain literal (not imported from the app) so the test
// stays a black-box check of the rendered site and fails loudly if routing
// changes without the tests being updated.

export type TestPage = {
  /** URL path (always trailing-slashed, matching `trailingSlash: true`). */
  path: string;
  /** Expected `<html lang>` value. */
  lang: string;
  /** Human label for test titles. */
  label: string;
};

// Country landing pages — every locale.
const countryPages: TestPage[] = [
  { path: "/uk/", lang: "en", label: "country uk" },
  { path: "/de/", lang: "de", label: "country de" },
  { path: "/de/en/", lang: "en", label: "country de-EN" },
  { path: "/fr/", lang: "fr", label: "country fr" },
  { path: "/fr/en/", lang: "en", label: "country fr-EN" },
  { path: "/nl/", lang: "nl", label: "country nl" },
  { path: "/nl/en/", lang: "en", label: "country nl-EN" },
  { path: "/at/", lang: "de", label: "country at" },
  { path: "/at/en/", lang: "en", label: "country at-EN" },
  { path: "/be/", lang: "en", label: "country be" },
  { path: "/cz/", lang: "cs", label: "country cz" },
  { path: "/cz/en/", lang: "en", label: "country cz-EN" },
  { path: "/dk/", lang: "da", label: "country dk" },
  { path: "/gr/", lang: "el", label: "country gr" },
  { path: "/no/", lang: "nb", label: "country no" },
  { path: "/pl/", lang: "pl", label: "country pl" },
  { path: "/se/", lang: "sv", label: "country se" },
];

// Airport-list pages — localized slugs per locale.
const airportListPages: TestPage[] = [
  { path: "/uk/airport-list-uk/", lang: "en", label: "list uk" },
  { path: "/de/flughafen-liste-deutschland/", lang: "de", label: "list de" },
  { path: "/de/en/airport-list-germany/", lang: "en", label: "list de-EN" },
  { path: "/fr/liste-des-aeroports-francais/", lang: "fr", label: "list fr" },
  { path: "/fr/en/airport-list-france/", lang: "en", label: "list fr-EN" },
  { path: "/nl/luchthavenlijst-nederland/", lang: "nl", label: "list nl" },
  { path: "/nl/en/airport-list-netherlands/", lang: "en", label: "list nl-EN" },
  { path: "/at/flughafen-liste-oesterreich/", lang: "de", label: "list at" },
  { path: "/at/en/airport-list-austria/", lang: "en", label: "list at-EN" },
  { path: "/be/airport-list-belgium/", lang: "en", label: "list be" },
  { path: "/cz/letiste-cesko/", lang: "cs", label: "list cz" },
  { path: "/dk/flyvepladser-danmark/", lang: "da", label: "list dk" },
  { path: "/gr/aerolimenes-ellada/", lang: "el", label: "list gr" },
  { path: "/no/flyplasser-norge/", lang: "nb", label: "list no" },
  { path: "/pl/lotniska-polska/", lang: "pl", label: "list pl" },
  { path: "/se/flygplatser-sverige/", lang: "sv", label: "list se" },
];

// Search pages — only where the type is available for the country.
const searchPages: TestPage[] = [
  // VFR: everywhere except France
  { path: "/uk/vfr/", lang: "en", label: "vfr uk" },
  { path: "/de/vfr/", lang: "de", label: "vfr de" },
  { path: "/nl/vfr/", lang: "nl", label: "vfr nl" },
  { path: "/at/vfr/", lang: "de", label: "vfr at" },
  // IFR: Germany only
  { path: "/de/ifr/", lang: "de", label: "ifr de" },
  { path: "/de/en/ifr/", lang: "en", label: "ifr de-EN" },
  // Heliports: everywhere except France
  { path: "/uk/heliports/", lang: "en", label: "heliports uk" },
  { path: "/de/heliports/", lang: "de", label: "heliports de" },
  { path: "/nl/heliports/", lang: "nl", label: "heliports nl" },
  { path: "/at/heliports/", lang: "de", label: "heliports at" },
  // Military + Aeroports: France only
  { path: "/fr/military/", lang: "fr", label: "military fr" },
  { path: "/fr/en/military/", lang: "en", label: "military fr-EN" },
  { path: "/fr/aeroports/", lang: "fr", label: "aeroports fr" },
  { path: "/fr/en/aeroports/", lang: "en", label: "aeroports fr-EN" },
  // Belgium/Luxembourg (vfr, ifr, heliports, military)
  { path: "/be/vfr/", lang: "en", label: "vfr be" },
  { path: "/be/ifr/", lang: "en", label: "ifr be" },
  { path: "/be/heliports/", lang: "en", label: "heliports be" },
  { path: "/be/military/", lang: "en", label: "military be" },
  // Czechia (ifr only)
  { path: "/cz/ifr/", lang: "cs", label: "ifr cz" },
  // vfr + heliports countries (sample)
  { path: "/dk/vfr/", lang: "da", label: "vfr dk" },
  { path: "/gr/heliports/", lang: "el", label: "heliports gr" },
  { path: "/no/vfr/", lang: "nb", label: "vfr no" },
  { path: "/pl/vfr/", lang: "pl", label: "vfr pl" },
  { path: "/se/vfr/", lang: "sv", label: "vfr se" },
];

/** Root landing page (`/`) — its own <html> with a manually rendered <head>. */
export const rootPage: TestPage = { path: "/", lang: "en", label: "root" };

/** Every indexable page whose metadata must be unique and complete. */
export const allPages: TestPage[] = [
  rootPage,
  ...countryPages,
  ...airportListPages,
  ...searchPages,
];

/** A representative subset for the (slower) accessibility sweep. */
export const a11yPages: TestPage[] = [
  rootPage,
  { path: "/de/", lang: "de", label: "country de" },
  { path: "/de/flughafen-liste-deutschland/", lang: "de", label: "list de" },
  { path: "/de/vfr/", lang: "de", label: "vfr de" },
  { path: "/fr/military/", lang: "fr", label: "military fr" },
];
