import { Header } from '~/app/_components/header';
import Search from '~/app/_components/search';
import { getTranslation } from '~/lib/i18n';

export default function Page({ params }: { params: { locale: string } }) {
  const translation = getTranslation({ tld: params.locale, english: false });

  return (
    <>
      <Header
        title={translation.VfrPage.title}
        description={translation.VfrPage.description}
      />
      <Search
        locale={params.locale}
        searchPlaceholder={translation.VfrPage.searchPlaceholder}
        searchResultHrefTitle={translation.VfrPage.searchResultHrefTitle}
        searchResultEmpty={translation.VfrPage.searchResultEmpty}
        type='vfr'
      />
    </>
  );
}