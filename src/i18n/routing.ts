import {createNavigation} from 'next-intl/navigation';
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['at', 'at-EN', 'de', 'de-EN', 'fr', 'fr-EN', 'nl', 'nl-EN', 'uk'],
  defaultLocale: 'uk',
  localePrefix: {
    mode: 'always',
    prefixes: {
      'at-EN': '/at/en',
      'de-EN': '/de/en',
      'fr-EN': '/fr/en',
      'nl-EN': '/nl/en',
    }
  },
  pathnames: {
    '/': '/',
    '/vfr': '/vfr',
    '/ifr': '/ifr',
    '/heliports': '/heliports',
    '/airport-list': {
      'at': '/flughafen-liste-oesterreich',
      'at-EN': '/airport-list-austria',
      'de': '/flughafen-liste-deutschland',
      'de-EN': '/airport-list-germany',
      'fr': '/liste-des-aeroports-francais',
      'fr-EN': '/airport-list-france',
      'nl': '/luchthavenlijst-nederland',
      'nl-EN': '/airport-list-netherlands',
      'uk': '/airport-list-uk'
    }
  },
  localeCookie: false,
  localeDetection: true,
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export const {Link, getPathname, redirect, usePathname, useRouter} =
  createNavigation(routing);

export const localeLangMapping: Record<typeof routing.locales[number] | string, string> = {
  'at': 'de',
  'at-EN': 'en',
  'de': 'de',
  'de-EN': 'en',
  'fr': 'fr',
  'fr-EN': 'en',
  'nl': 'nl',
  'nl-EN': 'en',
  'uk': 'en'
};

export const localeCountryMapping: Record<typeof routing.locales[number] | string, string> = {
  'at': 'at',
  'at-EN': 'at',
  'de': 'de',
  'de-EN': 'de',
  'fr': 'fr',
  'fr-EN': 'fr',
  'nl': 'nl',
  'nl-EN': 'nl',
  'uk': 'uk'
};