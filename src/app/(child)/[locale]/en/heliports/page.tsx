import { Header } from '~/app/_components/header';
import Search from '~/app/_components/search';
import { getTranslation } from '~/lib/i18n';
import { HydrateClient } from '~/trpc/server';

export default function Page({ params }: { params: { locale: string } }) {
  const translation = getTranslation({ tld: params.locale, english: true });

  return (
    <>
      <HydrateClient>
        <Header
          title={translation.HeliportPage.title}
          description={translation.HeliportPage.description}
        />
        <Search
          locale={params.locale}
          searchPlaceholder={translation.HeliportPage.searchPlaceholder}
          searchResultHrefTitle={translation.HeliportPage.searchResultHrefTitle}
          searchResultEmpty={translation.HeliportPage.searchResultEmpty}
          type='heliport'
        />
      </HydrateClient>
    </>
  );
}