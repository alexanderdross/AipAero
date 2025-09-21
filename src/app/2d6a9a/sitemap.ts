import type { MetadataRoute } from 'next'
import { notFound } from 'next/navigation';
import { getPathname, Locale, localeLangMapping, Pathnames, routing } from '~/i18n/routing';
import { i18nPathMapping, orgUrl } from '~/lib/utils';
import { QUERIES } from '~/server/db/queries';

export async function generateSitemaps() {
  const tlds = routing.locales.filter(x => x.length === 2);
  return tlds.map(tld => ({
    id: tld,
  }))
}

export default async function sitemap({
  id
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  // Check for valid tld
  const tlds = routing.locales.filter(x => x.length === 2);
  if (!tlds.includes(id as Locale)) {
    return notFound();
  }
  const pathnames = Object.keys(routing.pathnames) as Pathnames[];
  const entries = await Promise.all(pathnames.map((pathname) => getEntries(pathname, id as Locale)));
  return entries.flat();
}

type Href = Parameters<typeof getPathname>[0]['href'];

async function getEntries(pathname: Href, country: Locale) {
  // Only show IFR page for Germany
  if (pathname === '/ifr' && country !== 'de' && country !== 'de-EN') {
    return [];
  }
  // Don't show vfr or ifr or heliport page for France
  if ((country === 'fr' || country === 'fr-EN') && (pathname === "/vfr" || pathname === "/ifr" || pathname === "/heliports")) {
    return [];
  }
  // Alternate languages are the current country and its optional English version
  const alternateLangs = routing.locales.filter(l => l.startsWith(country)).map(l => ({
    locale: l,
    lang: localeLangMapping[l],
  }));
  // Both the current country and its English version of the base pathname should be included
  const pageEntries = alternateLangs.map(l => ({
    url: getUrl(pathname, l.locale),
    alternates: {
      languages: Object.fromEntries(
        alternateLangs.map((l) => [l.lang, getUrl(pathname, l.locale)])
      )
    },
  }));
  // In case of the airport list, repeat for every airport
  if (pathname === '/airport-list') {
    const [vfrAirports, ifrAirports, heliports, aeroports, militaryAirports] = await Promise.all([
      QUERIES.vfrAirports(country),
      QUERIES.ifrAirports(country),
      QUERIES.heliports(country),
      QUERIES.aeroportAirports(country),
      QUERIES.militaryAirports(country),
    ]);
    const airports = [vfrAirports, ifrAirports, heliports, aeroports, militaryAirports].filter(x => x.length > 0).flat()
    const airportEntries = airports.map(x => {
      return alternateLangs.map(l => ({
        url: getAirportUrl(i18nPathMapping[x.type], x.slug, l.locale),
        alternates: {
          languages: Object.fromEntries(
            alternateLangs.map((l) => [l.lang, getAirportUrl(i18nPathMapping[x.type], x.slug, l.locale)])
          )
        },
      }));
    }).flat();
    return [...pageEntries, ...airportEntries];
  }
  return [...pageEntries];
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getPathname({ locale, href });
  if (!pathname.endsWith('/')) {
    return new URL(pathname + '/', orgUrl).toString();
  }
  return new URL(pathname, orgUrl).toString();
}

function getAirportUrl(href: Href, slug: string, locale: Locale) {
  const pathname = getPathname({ locale, href });
  return new URL(`${pathname}?${slug}`, orgUrl).toString();
}