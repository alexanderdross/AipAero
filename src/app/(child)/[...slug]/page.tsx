'use server';

import { notFound } from 'next/navigation';
import About from '~/app/_components/about';
import { ContentAirportsPage } from '~/app/_components/pages/content-airports-page';
import { ContentCountryPage } from '~/app/_components/pages/content-country-page';
import { ContentSearchPage } from '~/app/_components/pages/content-search-page';
import { getTranslation, getTranslations, type Translation } from '~/lib/i18n';

function lastUrlSegment(url: string) {
  return url.split('/').filter(Boolean).at(-1);
}

function splitUrlSegments(url: string) {
  return url.split('/').filter(Boolean);
}

// generateStaticParams will be called at build time, important for sitemap.xml
export async function generateStaticParams({ params }: { params: { slug: string[] } }) {
  const nativeTranslation = await getTranslations({ english: false });
  const englishTranslation = await getTranslations({ english: true });
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
    }
  }
  return routes;
}

export default async function Page({ 
  params
}: { params: { slug: string[] } }) {
  const countryCode = params.slug.at(0);
  if (!countryCode) {
    return notFound();
  }
  const isEnglish = params.slug.at(1) === "en";

  // Get translation depending on countryCode code and language
  let translation: Translation;
  try {
    translation = await getTranslation({ tld: countryCode, english: isEnglish });
  } catch {
    return notFound();
  }
  if (translation.isSingleLocale && isEnglish) {
    return notFound();
  }

  // Return Country Page if requested
  if (params.slug.length === 1 && !isEnglish || params.slug.length === 2 && isEnglish) {
    return <>
      <ContentCountryPage translation={translation} />
      <About translation={translation.About} titleAs='h3' />
    </>;
  }

  const pageSlug = isEnglish ? params.slug.at(2) : params.slug.at(1);
  if (!pageSlug) {
    return notFound();
  }

  // const airportQuery = isEnglish ? params.slug.at(3) : params.slug.at(2);
  const type = pageSlug === lastUrlSegment(translation.VfrPage.href)
    ? 'vfr'
    : translation.IfrPage && pageSlug === lastUrlSegment(translation.IfrPage?.href)
      ? 'ifr' : pageSlug === lastUrlSegment(translation.HeliportPage.href)
        ? 'heliport' : undefined;

  if (type === 'vfr') {
    return <>
      <ContentSearchPage translation={translation.VfrPage} type={type} />
      <About translation={translation.About} titleAs='h2' />
    </>;
  }
  if (type === 'ifr' && translation.IfrPage) {
    return <>
      <ContentSearchPage translation={translation.IfrPage} type={type} />
      <About translation={translation.About} titleAs='h2' />
    </>;
  }
  if (type === 'heliport') {
    return <>
      <ContentSearchPage translation={translation.HeliportPage} type={type} />
      <About translation={translation.About} titleAs='h2' />
    </>;
  }
  if (pageSlug === lastUrlSegment(translation.AirportsPage.href)) {
    return <>
      <ContentAirportsPage translation={translation} />
      <About translation={translation.About} titleAs='h3' />
    </>;
  }

  return notFound();
}