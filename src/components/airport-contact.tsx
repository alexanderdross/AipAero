import { GlobeIcon, MapPinIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";
import type { NormalizedFacts } from "~/lib/airport-facts";
import type { Airport } from "~/server/db/schema";

/**
 * Server-rendered contact / location box: the town the field serves, its official
 * website (both from OurAirports when the importer has run) and a Google Maps
 * link. The map link is the only outbound gadget that needs no server data - it
 * resolves the field by exact coordinates when we have them, else by ICAO/name.
 * The box always renders at least the map link, so a pilot can always jump to the
 * location.
 */
export async function AirportContact({
  airport,
  facts,
}: {
  airport: Airport;
  facts: NormalizedFacts | null;
}) {
  const t = await getTranslations("Common");

  const query =
    facts?.lat != null && facts?.lon != null
      ? `${facts.lat},${facts.lon}`
      : `${airport.icao ?? airport.title} airport`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <section className="border border-[#ccc] bg-white p-4">
      <h2 className="text-center text-xl font-normal">{t("location")}</h2>

      {/* Two-column grid: place / website / map link sit side by side on >= sm,
          stack to one column on mobile. */}
      <div className="mx-auto mt-3 grid max-w-2xl grid-cols-1 items-center gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
        {facts?.municipality && (
          <p className="flex justify-between gap-x-3">
            <span className="text-drossgray-dark">{t("location")}</span>
            <span className="text-right font-medium">{facts.municipality}</span>
          </p>
        )}
        {facts?.homeLink && (
          <ExternalLink
            href={facts.homeLink}
            hrefTitle={t("website")}
            className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
          >
            <GlobeIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{t("website")}</span>
          </ExternalLink>
        )}
        <ExternalLink
          href={mapUrl}
          hrefTitle={t("viewOnMap")}
          className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
        >
          <MapPinIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{t("viewOnMap")}</span>
        </ExternalLink>
      </div>
    </section>
  );
}
