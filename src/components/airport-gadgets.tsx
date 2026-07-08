import { MapPinIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AirportFacts } from "~/components/airport-facts";
import { AirportWeather } from "~/components/airport-weather";
import { ExternalLink } from "~/components/external-link";
import { getAirportWeather } from "~/lib/weather";
import type { Airport } from "~/server/db/schema";

/**
 * Extra gadgets shown on an airport detail page, below the chart link. The
 * weather + field-info gadget is fully server-rendered (see `AirportWeather`);
 * the Google Maps link is a plain outbound link (no server data needed). The
 * NOAA weather is fetched once here and passed down, so the map link can reuse
 * the station coordinates when available (a precise pin instead of a name query).
 *
 * `mt-24` clears the absolutely-positioned chart link that floats below the
 * search input on the detail view.
 */
export async function AirportGadgets({ airport }: { airport: Airport }) {
  const locale = await getLocale();
  const t = await getTranslations("Common");
  const { metar, taf } = await getAirportWeather(airport.icao);

  const query =
    metar?.lat != null && metar?.lon != null
      ? `${metar.lat},${metar.lon}`
      : `${airport.icao ?? airport.title} airport`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <div className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <AirportWeather metar={metar} taf={taf} locale={locale} />
        <AirportFacts icao={airport.icao} />
        <p className="text-center">
          <ExternalLink
            href={mapUrl}
            hrefTitle={t("viewOnMap")}
            className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
          >
            <MapPinIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{t("viewOnMap")}</span>
          </ExternalLink>
        </p>
      </div>
    </div>
  );
}
