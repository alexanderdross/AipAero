'use server';

import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ContentAirportPage } from '~/app/_components/content-airport-page';
import { ContentAirportsPage } from '~/app/_components/content-airports-page';
import { ContentCountryPage } from '~/app/_components/content-country-page';
import { ContentSearchPage } from '~/app/_components/content-search-page';
import { getTranslation, getTranslations, type Translation } from '~/lib/i18n';
import { db } from '~/server/db';
import { airports } from '~/server/db/schema';
import { api } from '~/trpc/server';

function lastUrlSegment(url: string) {
  return url.split('/').filter(Boolean).at(-1);
}

function splitUrlSegments(url: string) {
  return url.split('/').filter(Boolean);
}

// generateStaticParams will be called at build time, important for sitemap.xml
export async function generateStaticParams({ params }: { params: { slug: string[] } }) {
  const nativeTranslation = getTranslations({ english: false });
  const englishTranslation = getTranslations({ english: true });
  const routes = [];
  for (const language of [nativeTranslation, englishTranslation]) {
    for (const translation of language) {
      routes.push({ slug: splitUrlSegments(translation.CountryPage.href) });
      routes.push({ slug: splitUrlSegments(translation.VfrPage.href) });
      routes.push({ slug: splitUrlSegments(translation.HeliportPage.href) });
      routes.push({ slug: splitUrlSegments(translation.AirportsPage.href) });

      // Add IFR page if available
      if (translation.IfrPage?.href) {
        routes.push({ slug: splitUrlSegments(translation.IfrPage.href) });
      }

      // Get all airports of the country
      const airportsQuery = await db.query.airports.findMany({
        columns: {
          icao: true,
          type: true
        },
        where: eq(airports.country, translation.CountryCode),
        orderBy: [asc(airports.title)],
      })
      for (const airport of airportsQuery) {
        if (airport.type === "vfr") {
          routes.push({ slug: [...splitUrlSegments(translation.VfrPage.href), airport.icao] });
        } else if (airport.type === "ifr" && translation.IfrPage?.href) {
          routes.push({ slug: [...splitUrlSegments(translation.IfrPage.href), airport.icao] });
        } else if (airport.type === "heliport") {
          routes.push({ slug: [...splitUrlSegments(translation.HeliportPage.href), airport.icao] });
        }
      }
    }
  }
  return routes;
}

export default async function Page({ params }: { params: { slug: string[] } }) {
  const countryCode = params.slug.at(0);
  if (!countryCode) {
    return notFound();
  }
  const isEnglish = params.slug.at(1) === "en";

  // Get translation depending on countryCode code and language
  let translation: Translation;
  try {
    translation = getTranslation({ tld: countryCode, english: isEnglish });
  } catch {
    return notFound();
  }
  if (translation.isSingleLocale && isEnglish) {
    return notFound();
  }

  // Return Country Page if requested
  if (params.slug.length === 1 && !isEnglish || params.slug.length === 2 && isEnglish) {
    return <ContentCountryPage translation={translation} />;
  }

  const pageSlug = isEnglish ? params.slug.at(2) : params.slug.at(1);
  if (!pageSlug) {
    return notFound();
  }

  const airportQuery = isEnglish ? params.slug.at(3) : params.slug.at(2);
  const type = pageSlug === lastUrlSegment(translation.VfrPage.href)
    ? 'vfr'
    : translation.IfrPage && pageSlug === lastUrlSegment(translation.IfrPage?.href)
      ? 'ifr' : pageSlug === lastUrlSegment(translation.HeliportPage.href)
        ? 'heliport' : undefined;
  
  if (airportQuery && type) {
    const airport = await api.airport.search({ type: type, country: translation.CountryCode, query: airportQuery });
    if (airport.length === 0 || !airport[0]) {
      return notFound();
    }
    if (type === 'vfr') {
      return <ContentAirportPage translation={translation.VfrPage} airport={airport[0]} />;
    }
    if (type === 'ifr' && translation.IfrPage) {
      return <ContentAirportPage translation={translation.IfrPage} airport={airport[0]} />;
    }
    if (type === 'heliport') {
      return <ContentAirportPage translation={translation.HeliportPage} airport={airport[0]} />;
    }
  }

  if (type === 'vfr') {
    return <ContentSearchPage translation={translation.VfrPage} type={type} />;
  }
  if (type === 'ifr' && translation.IfrPage) {
    return <ContentSearchPage translation={translation.IfrPage} type={type} />;
  }
  if (type === 'heliport') {
    return <ContentSearchPage translation={translation.HeliportPage} type={type} />;
  }
  if (pageSlug === lastUrlSegment(translation.AirportsPage.href)) {
    return <ContentAirportsPage translation={translation} />;
  }
  return notFound();
}