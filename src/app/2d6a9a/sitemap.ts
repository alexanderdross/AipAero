import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";
import {
  getPathname,
  type Locale,
  localeLangMapping,
  type Pathnames,
  routing,
} from "~/i18n/routing";
import {
  countryHasType,
  i18nPathMapping,
  liveCountries,
  orgUrl,
} from "~/lib/utils";
import type { Airport } from "~/server/db/schema";
import { QUERIES } from "~/server/db/queries";
import { modifiedDate as buildDate } from "~/lib/build-info";

// ISR safety net (see airport-list/page.tsx): deploys seed the build's empty
// prerender; hourly revalidation bounds how long the sitemaps miss the
// airport entries if the post-deploy revalidate call and crawler POSTs are
// unavailable.
export const revalidate = 3600;

// Which search-page path maps to which airport type (for availability gating).
const TYPE_BY_PATH: Record<string, Airport["type"]> = {
  "/vfr": "vfr",
  "/ifr": "ifr",
  "/heliports": "heliport",
  "/military": "mil",
  "/aeroports": "aeroport",
};

export async function generateSitemaps() {
  // Only countries with a verified, data-feeding crawler get a sitemap
  // (liveCountries); hidden countries would only expose empty pages.
  const tlds = routing.locales.filter(
    (x) => x.length === 2 && liveCountries.includes(x),
  );
  return tlds.map((tld) => ({
    id: tld,
  }));
}

export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  // Check for valid, live tld (hidden countries 404 their sitemap too)
  const tlds = routing.locales.filter(
    (x) => x.length === 2 && liveCountries.includes(x),
  );
  if (!tlds.includes(id as Locale)) {
    return notFound();
  }
  // lastmod = the real per-country crawl timestamp (tagged with the country
  // tag, so a fresh crawler POST busts this read and moves the date daily);
  // fall back to the build date for a country not yet crawled since deploy.
  // Bing WMT flags a sitemap whose lastmod never changes as stale ("should
  // update at least once a day") - the daily crawl now drives it.
  const crawledAtUnix = await QUERIES.crawlUpdatedAt(id);
  const lastModified = crawledAtUnix
    ? new Date(crawledAtUnix * 1000)
    : new Date(buildDate);

  const pathnames = Object.keys(routing.pathnames) as Pathnames[];
  const entries = await Promise.all(
    pathnames.map((pathname) =>
      getEntries(pathname, id as Locale, lastModified),
    ),
  );
  return entries.flat();
}

type Href = Parameters<typeof getPathname>[0]["href"];

async function getEntries(pathname: Href, country: Locale, lastModified: Date) {
  // Gate search-page entries by the country's available types (single source
  // of truth: countryTypeAvailability). "/" and "/airport-list" always emit.
  const type = TYPE_BY_PATH[pathname as string];
  if (type && !countryHasType(country, type)) {
    return [];
  }
  // Alternate languages are the current country and its optional English version
  const alternateLangs = routing.locales
    .filter((l) => l.startsWith(country))
    .map((l) => ({
      locale: l,
      lang: localeLangMapping[l],
    }));
  // Single-locale countries (uk, be) serve one language, so emit no alternate-
  // language links - a lone self-referential hreflang is redundant.
  const emitAlternates = alternateLangs.length > 1;
  // x-default fallback (for languages we do not target) points at the English
  // version, mirroring the page metadata's hreflang set.
  const englishLocale = `${country}-EN` as Locale;
  // Both the current country and its English version of the base pathname should be included
  const pageEntries = alternateLangs.map((l) => ({
    url: getUrl(pathname, l.locale),
    lastModified,
    ...(emitAlternates
      ? {
          alternates: {
            languages: Object.fromEntries([
              ...alternateLangs.map((l) => [
                l.lang,
                getUrl(pathname, l.locale),
              ]),
              ["x-default", getUrl(pathname, englishLocale)],
            ]),
          },
        }
      : {}),
  }));
  // In case of the airport list, repeat for every airport. One cached read
  // for the whole country (the per-airport entries carry their own type) -
  // the former five per-type queries cost five tag-cache checks + D1 misses
  // + R2 writes on every sitemap regeneration.
  if (pathname === "/airport-list") {
    const airports = await QUERIES.airportsByCountry(country);
    const airportEntries = airports
      .map((x) => {
        return alternateLangs.map((l) => ({
          url: getAirportUrl(i18nPathMapping[x.type], x.slug, l.locale),
          lastModified,
          ...(emitAlternates
            ? {
                alternates: {
                  languages: Object.fromEntries([
                    ...alternateLangs.map((l) => [
                      l.lang,
                      getAirportUrl(i18nPathMapping[x.type], x.slug, l.locale),
                    ]),
                    [
                      "x-default",
                      getAirportUrl(
                        i18nPathMapping[x.type],
                        x.slug,
                        englishLocale,
                      ),
                    ],
                  ]),
                },
              }
            : {}),
        }));
      })
      .flat();
    return [...pageEntries, ...airportEntries];
  }
  return [...pageEntries];
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getPathname({ locale, href });
  if (!pathname.endsWith("/")) {
    return new URL(pathname + "/", orgUrl).toString();
  }
  return new URL(pathname, orgUrl).toString();
}

function getAirportUrl(href: Href, slug: string, locale: Locale) {
  const pathname = getPathname({ locale, href });
  return new URL(`${pathname}?${slug}`, orgUrl).toString();
}
