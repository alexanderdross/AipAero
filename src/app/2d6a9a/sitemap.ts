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
  const pathnames = Object.keys(routing.pathnames) as Pathnames[];
  const entries = await Promise.all(
    pathnames.map((pathname) => getEntries(pathname, id as Locale)),
  );
  return entries.flat();
}

type Href = Parameters<typeof getPathname>[0]["href"];

async function getEntries(pathname: Href, country: Locale) {
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
  // Both the current country and its English version of the base pathname should be included
  const pageEntries = alternateLangs.map((l) => ({
    url: getUrl(pathname, l.locale),
    alternates: {
      languages: Object.fromEntries(
        alternateLangs.map((l) => [l.lang, getUrl(pathname, l.locale)]),
      ),
    },
  }));
  // In case of the airport list, repeat for every airport
  if (pathname === "/airport-list") {
    const [vfrAirports, ifrAirports, heliports, aeroports, militaryAirports] =
      await Promise.all([
        QUERIES.vfrAirports(country),
        QUERIES.ifrAirports(country),
        QUERIES.heliports(country),
        QUERIES.aeroportAirports(country),
        QUERIES.militaryAirports(country),
      ]);
    const airports = [
      vfrAirports,
      ifrAirports,
      heliports,
      aeroports,
      militaryAirports,
    ]
      .filter((x) => x.length > 0)
      .flat();
    const airportEntries = airports
      .map((x) => {
        return alternateLangs.map((l) => ({
          url: getAirportUrl(i18nPathMapping[x.type], x.slug, l.locale),
          alternates: {
            languages: Object.fromEntries(
              alternateLangs.map((l) => [
                l.lang,
                getAirportUrl(i18nPathMapping[x.type], x.slug, l.locale),
              ]),
            ),
          },
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
