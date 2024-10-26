import type { Translation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import { LinkIcon } from "@heroicons/react/solid";
import { type AirportGetAllOfCountryOutput } from "~/server/api/root";
import Metadata, { orgUrl } from "~/app/_components/metadata";
import Link from "next/link";
import { SchemaProduct } from "~/app/_components/schemas/schema-product";
import Breadcrumbs from "~/app/_components/breadcrumbs";
import { db } from "~/server/db";
import { airports } from "~/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";

interface Props {
  title: string;
  description: string;
  internalBaseHref: string;
  hrefDescription: string;
  airports: AirportGetAllOfCountryOutput;
}

function AirportList({
  title,
  description,
  hrefDescription,
  internalBaseHref,
  airports
}: Props) {
  return <>
    {airports.length > 0 && (<div className="bg-white py-8 px-6 border border-[#ccc] flex-grow basis-0 min-w-80">
      <h2 className="text-center text-2xl font-normal">{title}</h2>
      <p className="text-center pb-2">{description}</p>
      <ol>
        {airports.map((airport, index) => {
          const url = new URL(`${internalBaseHref}?${airport.icao}`, orgUrl).toString();
          const description = hrefDescription.replace('XXXX', airport.title);
          return (
            <li
              key={airport.icao}
              itemScope
              itemType="https://schema.org/Airport"
              className="flex items-center gap-x-4"
            >
              <span>{index + 1}.</span>
              <Link
                key={airport.icao}
                href={url}
                itemProp="url"
                className="text-drossblue py-2 flex gap-x-2 justify-left hover:underline"
                title={description}
                aria-label={description}
                target="_blank"
                rel="noopener"
              >
                <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                <span itemProp="name">{airport.title}</span>
              </Link>
              <meta itemProp="description" content={description} />
              <meta itemProp="icaoCode" content={airport.icao} />
            </li>
          );
        })}
      </ol>
    </div>)}
  </>;
}

export async function ContentAirportsPage({ translation }: { translation: Translation; }) {
  headers();
  const data = await db.query.airports.findMany({
    columns: {
      title: true,
      icao: true,
      url: true,
      type: true
    },
    where: eq(airports.country, translation.AirportsPage.Tld),
    orderBy: [asc(airports.title)],
  });

  const vfrAirports = data.filter((airport) => airport.type === "vfr");
  const ifrAirports = data.filter((airport) => airport.type === "ifr");
  const heliports = data.filter((airport) => airport.type === "heliport");

  return (
    <>
      <Metadata
        title={`🛩️ ${translation.AirportsPage.title}`}
        description={`${translation.AirportsPage.description}🗺️`}
        href={translation.AirportsPage.href}
        alternates={translation.AirportsPage.alternate && translation.AirportsPage.alternateIetfLang
          ? [{ href: translation.AirportsPage.href, hrefLang: translation.AirportsPage.ietfLang },
          { href: translation.AirportsPage.alternate, hrefLang: translation.AirportsPage.alternateIetfLang }]
          : [{ href: translation.AirportsPage.href, hrefLang: translation.AirportsPage.ietfLang }]}
      />
      <SchemaProduct
        name={translation.AirportsPage.title}
        alternateName={`${translation.AirportsPage.menuTitle} ${translation.AirportsPage.Country}`}
        description={translation.AirportsPage.description}
      />
      <Breadcrumbs translation={translation} />
      <Header
        title={translation.AirportsPage.title}
        description={translation.AirportsPage.description}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-6">
          {<AirportList
            title={translation.AirportsPage.VfrAirportsTitle}
            description={translation.AirportsPage.VfrAirportsDescription}
            hrefDescription={translation.VfrPage.airportPageDescription}
            internalBaseHref={translation.VfrPage.href}
            airports={vfrAirports}
          />}
          {translation.IfrPage && <AirportList
            title={translation.AirportsPage.IfrAirportsTitle}
            description={translation.AirportsPage.IfrAirportsDescription}
            hrefDescription={translation.IfrPage.airportPageDescription}
            internalBaseHref={translation.IfrPage.href}
            airports={ifrAirports}
          />}
          {<AirportList
            title={translation.AirportsPage.HeliportAirportsTitle}
            description={translation.AirportsPage.HeliportAirportsDescription}
            hrefDescription={translation.HeliportPage.airportPageDescription}
            internalBaseHref={translation.HeliportPage.href}
            airports={heliports}
          />}
        </div>
      </div>
    </>
  );
}