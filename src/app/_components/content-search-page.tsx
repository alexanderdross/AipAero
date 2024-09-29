import type { SearchPageTranslation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import Search from "~/app/_components/search";
import { generateAirportSchema, generateProductSchema } from "~/lib/generate-schema";
import Metadata from "~/app/_components/metadata";

export function ContentSearchPage({ translation, type }: { 
  translation: SearchPageTranslation; type: 'vfr' | 'ifr' | 'heliport';
}) {
  return (
    <>
      <Metadata
        title={translation.title}
        description={translation.description}
        url={translation.href}
        alternates={translation.alternate && translation.alternateIetfLang
          ? [{ href: translation.href, hrefLang: translation.ietfLang },
          { href: translation.alternate, hrefLang: translation.alternateIetfLang }]
          : [{ href: translation.href, hrefLang: translation.ietfLang }]}
      />
      {generateProductSchema(
        translation.title, // name
        `${translation.menuTitle} ${translation.Country}`, // alternateName
        translation.description, // description
        translation.href // href
      )}
      {generateAirportSchema(
        translation.title, // name
        translation.description, // description
      )}
      <Header
        title={translation.title}
        description={translation.description}
      />
      <Search
        countryCode={translation.Tld}
        searchPlaceholder={translation.searchPlaceholder}
        searchResultHrefTitle={translation.searchResultHrefTitle}
        searchResultEmpty={translation.searchResultEmpty}
        type={type}
      />
    </>
  );
}