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

      {facts?.municipality && (
        <p className="mt-3 text-center text-sm">
          <span className="text-drossgray-dark">{airport.title}</span>
          {", "}
          <span className="font-medium">{facts.municipality}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
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
