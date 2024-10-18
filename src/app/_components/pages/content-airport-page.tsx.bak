import type { SearchPageTranslation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import Metadata from "~/app/_components/metadata";
import { type AirportSearchOutput } from "~/server/api/root";
import { ExternalLink } from "~/app/_components/external-link";
import { LinkIcon } from "@heroicons/react/solid";
import { SchemaProduct } from "../schemas/schema-product";
import { SchemaAirport } from "../schemas/schema-airport";

export function ContentAirportPage({ translation, airport }: {
  translation: SearchPageTranslation;
  airport: AirportSearchOutput[number]
}) {
  const title = `${translation.airportPageTitle} ${airport.title}`;
  const description = translation.airportPageDescription.replace('XXXX', airport.title);
  return (
    <>
      <Metadata
        title={title}
        description={description}
        href={translation.href}
        alternates={translation.alternate && translation.alternateIetfLang
          ? [{ href: translation.href, hrefLang: translation.LanguageCode },
          { href: translation.alternate, hrefLang: translation.alternateIetfLang }]
          : [{ href: translation.href, hrefLang: translation.LanguageCode }]}
      />
      <SchemaProduct
        name={title}
        alternateName={translation.menuTitle}
        description={description}
      />
      <SchemaAirport
        name={airport.title}
        icaoCode={airport.icao}
        alternateName={airport.title}
        description={description}
      />
      <Header
        title={title}
        description={description}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl pr-8 sm:pr-12 lg:pr-16 text-center mt-3 w-full text-white absolute">
          <div key={airport.icao} itemScope itemType="https://schema.org/Airport">
            <ExternalLink
              key={airport.icao}
              href={`${airport.url}`}
              className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
              hrefTitle={`${translation.searchResultHrefTitle} ${airport.title}`}
            >
              <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
              <span itemProp="name">{airport.title}</span>
            </ExternalLink>
            <meta itemProp="description" content={`${translation.searchResultHrefTitle} ${airport.title}`} />
            <meta itemProp="icaoCode" content={airport.icao} />
          </div>
        </div>
      </div>
    </>
  );
}