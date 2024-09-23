import { Header } from '~/app/_components/header';
import Search from '~/app/_components/search';
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
    return (
      <>
        <Header
          title={translation.IfrPage.title}
          description={translation.IfrPage.description}
        />
        <Search
          locale={params.locale}
          searchPlaceholder={translation.IfrPage.searchPlaceholder}
          searchResultHrefTitle={translation.IfrPage.searchResultHrefTitle}
          searchResultEmpty={translation.IfrPage.searchResultEmpty}
          type='ifr'
        />
      </>
    );
  }

  return (
    <>
      <Header title={translation.AirportsPage.title} description={translation.AirportsPage.description} />
    </>
  );
}