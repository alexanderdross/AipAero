import type { Translation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import { LinkIcon } from "@heroicons/react/solid";
import { api } from "~/trpc/server";
import { type AirportGetAllOfCountryOutput } from "~/server/api/root";
import Metadata, { orgUrl } from "~/app/_components/metadata";
import Link from "next/link";
import { SchemaProduct } from "../schemas/schema-product";

function generateAirportList(title: string, description: string, internalBaseHref: string, airports: AirportGetAllOfCountryOutput) {
  return <>
    {airports.length > 0 && (<div className="bg-white py-8 px-6 border border-[#ccc] flex-grow basis-0 whitespace-nowrap">
      <h2 className="text-center text-2xl font-normal">{title}</h2>
      <p className="text-center pb-2">{description}</p>
      <ol>
        {airports.map((airport, index) => (
          <li key={airport.icao} itemScope itemType="https://schema.org/Airport" className="flex items-center gap-x-4">
            <span>{index + 1}.</span>
            <Link
              key={airport.icao}
              //href={new URL(`${airport.icao}/`, new URL(internalBaseHref, orgUrl)).toString()}
              href={new URL(`${internalBaseHref}?${airport.icao}/`, orgUrl).toString()}
              className="text-drossblue py-2 flex gap-x-2 justify-left hover:underline"
              title={airport.title}
              target="_blank"
              rel="noopener"
            >
              <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
              <span itemProp="name">{airport.title}</span>
            </Link>
            <meta itemProp="description" content={airport.title} />
            <meta itemProp="icaoCode" content={airport.icao} />
          </li>
        ))}
      </ol>
    </div>)}
  </>;
}

export async function ContentAirportsPage({ translation }: { translation: Translation; }) {
  const data = await api.airport.getAllOfCountry({ country: translation.AirportsPage.Tld });
  const vfr = data.filter((airport) => airport.type === "vfr");
  const ifr = data.filter((airport) => airport.type === "ifr");
  const heliport = data.filter((airport) => airport.type === "heliport");

  return (
    <>
      <Metadata
        title={translation.AirportsPage.title}
        description={translation.AirportsPage.description}
        url={translation.AirportsPage.href}
        alternates={translation.AirportsPage.alternate && translation.AirportsPage.alternateIetfLang
          ? [{ href: translation.AirportsPage.href, hrefLang: translation.AirportsPage.ietfLang },
          { href: translation.AirportsPage.alternate, hrefLang: translation.AirportsPage.alternateIetfLang }]
          : [{ href: translation.AirportsPage.href, hrefLang: translation.AirportsPage.ietfLang }]}
      />
      <SchemaProduct
        name={translation.AirportsPage.title}
        alternateName={`${translation.AirportsPage.menuTitle} ${translation.AirportsPage.Country}`}
        description={translation.AirportsPage.description}
        href={translation.AirportsPage.href}
      />
      <Header
        title={translation.AirportsPage.title}
        description={translation.AirportsPage.description}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-6">
          {generateAirportList(translation.AirportsPage.VfrAirportsTitle, translation.AirportsPage.VfrAirportsDescription, translation.VfrPage.href, vfr)}
          {translation.IfrPage && generateAirportList(translation.AirportsPage.IfrAirportsTitle, translation.AirportsPage.IfrAirportsDescription, translation.IfrPage.href, ifr)}
          {generateAirportList(translation.AirportsPage.HeliportAirportsTitle, translation.AirportsPage.HeliportAirportsDescription, translation.HeliportPage.href, heliport)}
        </div>
      </div>
    </>
  );
}