import { ContentAirportsPage } from '~/app/_components/content-airports-page';
import { ContentSearchPage } from '~/app/_components/content-search-page';
import { getTranslation } from '~/lib/i18n';

// All slugs besides the static ones will be 404
export const dynamicParams = false;

// generateStaticParams will be called at build time, important for sitemap.xml
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const translation = getTranslation({ tld: params.locale, english: true });
  const routes = [{ airportList: translation.AirportsPage.href.split('/').filter(Boolean).at(-1) }];

  // Add IFR page if available
  if (translation.IfrPage?.href) {
    routes.push({ airportList: translation.IfrPage.href.split('/').filter(Boolean).at(-1) });
  }
  return routes;
}

export default function Page({ params }: { params: { locale: string; airportList: string } }) {
  const translation = getTranslation({ tld: params.locale, english: true });

  // Return IFR page if available
  if (params.airportList === translation.IfrPage?.href) {
    return ContentSearchPage({ locale: params.locale, translation: translation.IfrPage });
  }

  return ContentAirportsPage({ locale: params.locale, translation: translation.AirportsPage });
}