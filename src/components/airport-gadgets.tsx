import { getLocale } from "next-intl/server";
import { AirportContact } from "~/components/airport-contact";
import { AirportFacts } from "~/components/airport-facts";
import { AirportWeather } from "~/components/airport-weather";
import { getAirportFacts } from "~/lib/airport-facts";
import { getAirportWeather } from "~/lib/weather";
import type { Airport } from "~/server/db/schema";

/**
 * Extra gadgets shown on an airport detail page, below the chart link. Three
 * server-rendered boxes: contact/location (town, website, Google Maps), weather
 * (raw + decoded METAR/TAF), and aerodrome data (elevation, runways, frequencies,
 * opening hours, sunrise/sunset). Weather and facts are each fetched once here and
 * passed down, so the boxes share the data without duplicate queries (and the
 * facts row feeds both the map pin and the sun-times calc).
 *
 * `mt-24` clears the absolutely-positioned chart link that floats below the
 * search input on the detail view.
 */
export async function AirportGadgets({ airport }: { airport: Airport }) {
  const locale = await getLocale();
  const [{ metar, taf }, facts] = await Promise.all([
    getAirportWeather(airport.icao),
    getAirportFacts(airport.icao),
  ]);

  return (
    <div className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        {/* Location + aerodrome-data boxes side by side on >= md (each half
            width), stacking on mobile. Weather spans the full width below, as it
            carries the wide raw METAR/TAF blocks. */}
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <AirportContact airport={airport} facts={facts} />
          <AirportFacts facts={facts} metar={metar} locale={locale} />
        </div>
        <AirportWeather metar={metar} taf={taf} locale={locale} />
      </div>
    </div>
  );
}
