import type { Translation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import Metadata from "~/app/_components/metadata";
import { SchemaProduct } from "~/app/_components/schemas/schema-product";
import { SchemaAirport } from "~/app/_components/schemas/schema-airport";
import { SchemaWebsite } from "~/app/_components/schemas/schema-website";
import Breadcrumbs from "~/app/_components/breadcrumbs";
import { findAirport } from "~/app/_actions/db";
import { notFound } from "next/navigation";
import { SearchInput } from "~/app/_components/search-input";
import { ExternalLink } from "../external-link";
import { ExternalLinkIcon } from "@heroicons/react/solid";

interface Props {
  translation: Translation;
  type: 'vfr' | 'ifr' | 'heliport';
  countryCode: string;
  searchParams?: Record<string, string | string[] | undefined>;
}

export async function ContentSearchPage({
  translation,
  type,
  countryCode,
  searchParams,
}: Props) {
  const icaoParam = Object.keys(searchParams ?? {}).at(0);
  const currentTranslation = type === 'vfr' ? translation.VfrPage : type === 'ifr' ? translation.IfrPage : translation.HeliportPage;
  if (!currentTranslation) {
    return notFound();
  }
  let airport;
  if (icaoParam) {
    airport = await findAirport(icaoParam, countryCode, type);
  }

  const title = airport
    ? `${currentTranslation.airportPageTitle}${airport.title}` : currentTranslation.title;
  const description = airport
    ? currentTranslation.airportPageDescription.replace('XXXX', airport.title) : currentTranslation.description;

  return (
    <>
      <Metadata
        title={title}
        description={description}
        href={currentTranslation.href}
        alternates={currentTranslation.alternate && currentTranslation.alternateIetfLang
          ? [{ href: currentTranslation.href, hrefLang: currentTranslation.ietfLang },
          { href: currentTranslation.alternate, hrefLang: currentTranslation.alternateIetfLang }]
          : [{ href: currentTranslation.href, hrefLang: currentTranslation.ietfLang }]}
        param={icaoParam}
      />
      <SchemaProduct
        name={title}
        alternateName={currentTranslation.menuTitle}
        description={description}
        icaoParam={icaoParam}
      />
      {airport && <SchemaAirport
        name={airport.title}
        icaoCode={airport.icao}
        alternateName={title}
        description={description}
      />}
      <SchemaWebsite />

      <Breadcrumbs
        airportTitle={airport?.title}
        airportDescription={title}
        translation={translation}
      />
      <Header
        title={title}
        description={description}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SearchInput
          initialValue={icaoParam}
          translation={currentTranslation}
          type={type}
        />
      </div>

      {airport && (
        <div className="max-w-7xl px-4 sm:px-6 lg:px-8 text-center mt-3 w-full text-white absolute left-1/2 transform -translate-x-1/2">
          <ol>
            <li>
              <ExternalLink
                key={airport.icao}
                href={`${airport.url}`}
                className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                hrefTitle={`${currentTranslation.searchResultHrefTitle} ${airport.title}`}
              >
                <ExternalLinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                <span>{airport.title}</span>
              </ExternalLink>
            </li>
          </ol>
        </div>
      )}
    </>
  );
}