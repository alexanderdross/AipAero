import {Pathnames, LocalePrefix} from 'next-intl/routing';

export const defaultLocale = 'uk' as const;
export const locales = ['uk', 'de', 'de/en'] as const;

export const pathnames: Pathnames<typeof locales> = {
  '/': '/',
  '/pathnames': {
    uk: '/pathnames',
    de: '/pfadnamen',
    'de/en': '/pathnames'
  }
};

export const localePrefix: LocalePrefix<typeof locales> = 'always';

export const port = process.env.PORT || 3000;
export const host = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${port}`;
