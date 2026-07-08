import { MapPinIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AirportWeather } from "~/components/airport-weather";
import { ExternalLink } from "~/components/external-link";
import type { Airport } from "~/server/db/schema";

/**
 * Extra gadgets shown on an airport detail page, below the chart link. The
 * weather gadget is fully server-rendered (see `AirportWeather`). The Google
 * Maps link is a plain outbound link (no server data needed) - it resolves the
 * field from its ICAO/name query, so it works without stored coordinates.
 *
 * `mt-24` clears the absolutely-positioned chart link that floats below the
 * search input on the detail view.
 */
export async function AirportGadgets({ airport }: { airport: Airport }) {
  const locale = await getLocale();
  const t = await getTranslations("Common");

  const mapQuery = encodeURIComponent(
    `${airport.icao ?? airport.title} airport`,
  );
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return (
    <div className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <AirportWeather icao={airport.icao} locale={locale} />
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
