import type {Pathnames, LocalePrefix} from 'next-intl/routing';

export const defaultLocale = 'en';
export const locales = ['at', 'de', 'nl', 'uk' ];

export const pathnames: Pathnames<typeof locales> = {
  '/': '/',
  '/pathnames': {
    uk: '/pathnames',
    de: '/pfadnamen',
    'de/en': '/pathnames',
    'nl': '/padnamen',
    'nl/en': '/pathnames'
  }
};

export const localePrefix: LocalePrefix<typeof locales> = 'as-needed';

export const port = process.env.PORT ?? 3000;
export const host = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${port}`;
