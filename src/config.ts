import type {Pathnames, LocalePrefix} from 'next-intl/routing';

export const defaultLocale = 'de';
export const locales = ['at', 'de', 'nl', 'uk' ];

export const pathnames: Pathnames<typeof locales> = {
  '/': '/',
  '/pathnames': {
    at: '/pfadnamen',
    de: '/pfadnamen',
    nl: '/padnamen',
    uk: '/pathnames',
  }
  /*
    '/pathnames': {
    at: '/flughafen-liste-oesterreich/',
    de: '/flughafen-liste-deutschland/',
    nl: '/luchthavenlijst-nederland/',
    uk: '/airport-list-uk/',
  },
  '/en/airport-list/': {
    at: '/airport-list-austria/',
    de: '/airport-list-germany/',
    nl: '/airport-list-netherlands/'
  }
    */
};

export const localePrefix: LocalePrefix<typeof locales> = 'as-needed';

export const port = process.env.PORT ?? 3000;
export const host = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${port}`;
