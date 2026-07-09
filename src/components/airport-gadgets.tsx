import pick from "lodash/pick";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AirportChart } from "~/components/airport-chart";
import { AirportContact } from "~/components/airport-contact";
import { AirportFacts } from "~/components/airport-facts";
import { AirportNearby } from "~/components/airport-nearby";
import { AirportWeatherWind } from "~/components/airport-weather-wind";
import { SchemaAirport } from "~/components/schemas/schema-airport";
import { getAirportFacts } from "~/lib/airport-facts";
import { reverseGeocode } from "~/lib/geocode";
import { isPdfUrl } from "~/lib/utils";
import type { Airport } from "~/server/db/schema";

/**
 * Extra gadgets on an airport detail page, below the chart link. Split by SEO
 * value / cost:
 *
 * - **Server-rendered (indexable):** the location box (address, coordinates,
 *   phone, website, Google Maps) and the aerodrome-data box (elevation, runways,
 *   surface, frequencies, opening hours, sun times), plus the "nearby airfields"
 *   list. One `getAirportFacts` fetch feeds these AND the enriched Airport JSON-LD
 *   (geo / elevation / postal address), so the structured data matches the boxes.
 * - **Lazy (client-side):** the ephemeral weather + wind boxes, fetched from
 *   `/api/airport-weather` after the document streams (see `AirportWeatherWind`) -
 *   so the document closes quickly instead of holding the stream open for NOAA
 *   (the long-held stream is what Lighthouse scored as document/LCP latency).
 *
 * All fail-soft. `mt-24` clears the absolutely-positioned chart link.
 */
export async function AirportGadgets({
  airport,
  schemaName,
  schemaAlternateName,
  schemaDescription,
  schemaUrl,
}: {
  airport: Airport;
  schemaName: string;
  schemaAlternateName: string;
  schemaDescription: string;
  schemaUrl: string;
}) {
  const [locale, messages, facts] = await Promise.all([
    getLocale(),
    getMessages(),
    getAirportFacts(airport.icao),
  ]);

  const lat = facts?.lat ?? null;
  const lon = facts?.lon ?? null;

  const geo =
    lat != null && lon != null ? await reverseGeocode(lat, lon) : null;
  const openingHours = facts?.openingHours ?? geo?.openingHours ?? null;
  const street = geo
    ? [geo.road, geo.houseNumber].filter(Boolean).join(" ") || null
    : null;

  return (
    <div className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Enriched Airport JSON-LD - one facts fetch feeds this and the boxes. */}
      <SchemaAirport
        name={schemaName}
        icaoCode={airport.icao}
        alternateName={schemaAlternateName}
        description={schemaDescription}
        url={schemaUrl}
        latitude={lat}
        longitude={lon}
        elevationFt={facts?.elevationFt ?? null}
        street={street}
        postalCode={geo?.postcode ?? null}
        city={facts?.municipality ?? geo?.city ?? null}
        telephone={geo?.phone ?? null}
      />
      <div className="flex flex-col gap-4">
        {isPdfUrl(airport.url) && <AirportChart url={airport.url} />}
        {/* Location + aerodrome-data boxes side by side on >= md (each half
            width, stretched to equal height), stacking on mobile. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AirportContact
            airport={airport}
            facts={facts}
            geo={geo}
            lat={lat}
            lon={lon}
          />
          <AirportFacts
            facts={facts}
            locale={locale}
            openingHours={openingHours}
          />
        </div>
        {/* Ephemeral weather + wind: lazy-loaded client-side. The Weather i18n
            namespace is scoped to this client subtree. */}
        <NextIntlClientProvider messages={pick(messages, "Weather")}>
          <AirportWeatherWind
            icao={airport.icao}
            lat={lat}
            lon={lon}
            runways={facts?.runways ?? []}
            locale={locale}
          />
        </NextIntlClientProvider>
        <AirportNearby
          slug={airport.slug}
          lat={lat}
          lon={lon}
          country={airport.country}
          locale={locale}
        />
      </div>
    </div>
  );
}
