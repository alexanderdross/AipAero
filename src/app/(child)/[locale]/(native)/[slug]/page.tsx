import { notFound } from 'next/navigation';
import { ContentAirportsPage } from '~/app/_components/content-airports-page';
import { ContentSearchPage } from '~/app/_components/content-search-page';
import { getTranslation } from '~/lib/i18n';

// All slugs besides the static ones will be 404
export const dynamicParams = false;

function transformUrlToSlug(url: string) {
  return url.split('/').filter(Boolean).at(-1);
}

// generateStaticParams will be called at build time, important for sitemap.xml
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const translation = getTranslation({ tld: params.locale, english: false });
  const routes = [
    { slug: transformUrlToSlug(translation.VfrPage.href) },
    { slug: transformUrlToSlug(translation.HeliportPage.href) },
    { slug: transformUrlToSlug(translation.AirportsPage.href) }
  ];

  // Add IFR page if available
  if (translation.IfrPage?.href) {
    routes.push({ slug: transformUrlToSlug(translation.IfrPage.href) });
  }
  return routes;
}

export default function Page({ params }: { params: { locale: string; slug: string } }) {
  const translation = getTranslation({ tld: params.locale, english: false });

  if (params.slug === transformUrlToSlug(translation.VfrPage.href)) {
    return <ContentSearchPage translation={translation.VfrPage} type={'vfr'} />;
  }
  if (translation.IfrPage && params.slug === transformUrlToSlug(translation.IfrPage?.href)) {
    return <ContentSearchPage translation={translation.IfrPage} type='ifr' />;
  }
  if (params.slug === transformUrlToSlug(translation.HeliportPage.href)) {
    return <ContentSearchPage translation={translation.HeliportPage} type='heliport' />;
  }
  if (params.slug === transformUrlToSlug(translation.AirportsPage.href)) {
    return <ContentAirportsPage translation={translation.AirportsPage} />;
  }

  return notFound();
}