import type { SearchPageTranslation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import Search from "~/app/_components/search";

export function ContentSearchPage({locale, translation}: { locale: string; translation: SearchPageTranslation; }) {
  return (
    <>
      <Header
        title={translation.title}
        description={translation.description}
      />
      <Search
        locale={locale}
        searchPlaceholder={translation.searchPlaceholder}
        searchResultHrefTitle={translation.searchResultHrefTitle}
        searchResultEmpty={translation.searchResultEmpty}
        type='vfr'
      />
    </>
  );
}