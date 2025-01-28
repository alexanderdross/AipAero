import {createNavigation} from 'next-intl/navigation';
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['at', 'at-EN', 'de', 'de-EN', 'nl', 'nl-EN', 'uk'],
  defaultLocale: 'uk',
  localePrefix: {
    mode: 'always',
    prefixes: {
      'at-EN': '/at/en',
      'de-EN': '/de/en',
      'nl-EN': '/nl/en',
    }
  },
  pathnames: {
    '/': '/',
    '/airport-list': {
      'at': '/flughafen-liste-oesterreich',
      'at-EN': '/airport-list-austria',
      'de': '/flughafen-liste-deutschland',
      'de-EN': '/airport-list-germany',
      'nl': '/luchthavenlijst-nederland',
      'nl-EN': '/airport-list-netherlands',
      'uk': '/airport-list-uk'
    }
  },
  localeCookie: false,
  localeDetection: true
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export const {Link, getPathname, redirect, usePathname, useRouter} =
  createNavigation(routing);