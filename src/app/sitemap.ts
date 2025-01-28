import {MetadataRoute} from 'next';
import {Locale, getPathname, routing} from '~/i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
  return [getEntry('/'), getEntry('/airport-list')];
}

type Href = Parameters<typeof getPathname>[0]['href'];

function getEntry(href: Href) {
  return {
    url: getUrl(href, routing.defaultLocale),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, getUrl(href, locale)])
      )
    }
  };
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getPathname({locale, href});
  return 'https://aip.aero' + pathname;
}