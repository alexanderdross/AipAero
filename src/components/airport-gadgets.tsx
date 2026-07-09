import { getLocale } from "next-intl/server";
import { AirportChart } from "~/components/airport-chart";
import { AirportContact } from "~/components/airport-contact";
import { AirportFacts } from "~/components/airport-facts";
import { AirportNearby } from "~/components/airport-nearby";
import { AirportWeather } from "~/components/airport-weather";
import { getAirportFacts } from "~/lib/airport-facts";
import { reverseGeocode } from "~/lib/geocode";
import { getAirportWeather, getNearestWeather } from "~/lib/weather";
import { isPdfUrl } from "~/lib/utils";
import type { Airport } from "~/server/db/schema";

/**
 * Extra gadgets shown on an airport detail page, below the chart link. Three
 * server-rendered boxes: contact/location (address, coordinates, phone, website,
 * Google Maps), weather (raw + decoded METAR/TAF), and aerodrome data (elevation,
 * runways, frequencies, opening hours, sunrise/sunset). Weather and facts are
 * fetched once here; the postal address is then reverse-geocoded from the best
 * available coordinates (the facts row, else the METAR station) so it resolves
 * even before the OurAirports importer has run. All fail-soft.
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

  const lat = facts?.lat ?? metar?.lat ?? null;
  const lon = facts?.lon ?? metar?.lon ?? null;

  // When the field has no METAR/TAF of its own, fall back to the nearest
  // reporting station's weather (needs coordinates), clearly labelled. The
  // field's own METAR (if any) still feeds the aerodrome-data box's elevation /
  // sun-times fallback - the nearest station must not stand in for those.
  let weatherMetar = metar;
  let weatherTaf = taf;
  let nearest: { station: string; distanceKm: number } | null = null;
  if (!metar && !taf && lat != null && lon != null) {
    const near = await getNearestWeather(lat, lon);
    if (near) {
      weatherMetar = near.metar;
      weatherTaf = near.taf;
      nearest = { station: near.station, distanceKm: near.distanceKm };
    }
  }

  const geo =
    lat != null && lon != null ? await reverseGeocode(lat, lon) : null;
  const openingHours = facts?.openingHours ?? geo?.openingHours ?? null;

  return (
    <div className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        {isPdfUrl(airport.url) && <AirportChart url={airport.url} />}
        {/* Location + aerodrome-data boxes side by side on >= md (each half
            width, stretched to equal height), stacking on mobile. Weather spans
            the full width below, as it carries the wide raw METAR/TAF blocks. */}
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
            metar={metar}
            locale={locale}
            openingHours={openingHours}
          />
        </div>
        <AirportWeather
          metar={weatherMetar}
          taf={weatherTaf}
          locale={locale}
          nearest={nearest}
        />
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
