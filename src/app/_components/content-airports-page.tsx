import type { Translation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import { generateProductSchema } from "~/lib/generate-schema";
import { ExternalLink } from "./external-link";
import { LinkIcon } from "@heroicons/react/solid";
import { api } from "~/trpc/server";
import { type AirportGetAllOfCountryOutput } from "~/server/api/root";
import Metadata from "./metadata";

function generateAirportList(title: string, description: string, airports: AirportGetAllOfCountryOutput) {
  return <>
    {airports.length > 0 && (<div className="bg-white py-8 px-6 border border-[#ccc] flex-grow basis-0 whitespace-nowrap">
      <h2 className="text-center text-2xl font-normal">{title}</h2>
      <p className="text-center pb-2">{description}</p>
      <ol>
        {airports.map((airport, index) => (
          <li key={airport.icao} itemScope itemType="https://schema.org/Airport" className="flex items-center gap-x-4">
            <span>{index + 1}.</span>
            <ExternalLink
              key={airport.icao}
              href={`${airport.url}`}
              className="text-drossblue py-2 flex gap-x-2 justify-left hover:underline"
              hrefTitle={`${airport.title} ${airport.icao}`}
            >
              <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
              <span itemProp="name">{airport.title} {airport.icao}</span>
            </ExternalLink>
            <meta itemProp="description" content={`${airport.title} ${airport.icao}`} />
            <meta itemProp="icaoCode" content={airport.icao} />
          </li>
        ))}
      </ol>
    </div>)}
  </>;
}

export async function ContentAirportsPage({ translation }: { translation: Translation["AirportsPage"]; }) {
  const data = await api.airport.getAllOfCountry({ country: translation.Tld });
  const vfr = data.filter((airport) => airport.type === "vfr");
  const ifr = data.filter((airport) => airport.type === "ifr");
  const heliport = data.filter((airport) => airport.type === "heliport");

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
      <Header
        title={translation.title}
        description={translation.description}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-6">
          {generateAirportList(translation.VfrAirportsTitle, translation.VfrAirportsDescription, vfr)}
          {generateAirportList(translation.IfrAirportsTitle, translation.IfrAirportsDescription, ifr)}
          {generateAirportList(translation.HeliportAirportsTitle, translation.HeliportAirportsDescription, heliport)}
        </div>
      </div>
    </>
  );
}