import type { PageTranslation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import { generateProductSchema } from "~/lib/generate-schema";
import { ExternalLink } from "./external-link";
import { LinkIcon } from "@heroicons/react/solid";
import { api } from "~/trpc/server";

export async function ContentAirportsPage({translation}: { translation: PageTranslation; }) {
  const data = await api.airport.getAllOfCountry({country: translation.Tld});
  const vfr = data.filter((airport) => airport.type === "vfr");
  const ifr = data.filter((airport) => airport.type === "ifr");
  const heliport = data.filter((airport) => airport.type === "heliport");

  return (
    <>
      {generateProductSchema(
        translation.title, // name
        `${translation.menuTitle} ${translation.Country}`, // alternateName`${translation.menuTitle} ${translation.Country}`, // alternateName
        translation.description, // description
        translation.href // href
      )}
      <Header
        title={translation.title}
        description={translation.description}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ol>
          {data.map((airport, index) => (
            <li key={airport.icao} itemScope itemType="https://schema.org/Airport">
              <ExternalLink
                key={airport.icao}
                href={`${airport.url}`}
                className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                hrefTitle={`${airport.title} ${airport.icao}`}
              >
                <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                <span itemProp="name">{index+1} {airport.title} {airport.icao}</span>
              </ExternalLink>
              <meta itemProp="description" content={`${airport.title} ${airport.icao}`} />
              <meta itemProp="icaoCode" content={airport.icao} />
            </li>
          ))}
        </ol>
        {data.length === 0 && (
          <div className="bg-drossblue py-2">Nothing found</div>
        )}
      </div>
    </>
  );
}