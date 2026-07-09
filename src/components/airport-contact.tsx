import { GlobeIcon, MapPinIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { ExternalLink } from "~/components/external-link";
import type { NormalizedFacts } from "~/lib/airport-facts";
import type { GeoResult } from "~/lib/geocode";
import type { Airport } from "~/server/db/schema";

/**
 * Server-rendered contact / location box: postal address (street/postcode/town)
 * and contact phone from OpenStreetMap, coordinates, the official website, and a
 * Google Maps link. The map link is the only outbound gadget that needs no server
 * data - it resolves the field by exact coordinates when we have them, else by
 * ICAO/name. The box always renders at least the map link.
 */
export async function AirportContact({
  airport,
  facts,
  geo,
  lat,
  lon,
}: {
  airport: Airport;
  facts: NormalizedFacts | null;
  geo: GeoResult | null;
  lat: number | null;
  lon: number | null;
}) {
  const t = await getTranslations("Common");

  const query =
    lat != null && lon != null
      ? `${lat},${lon}`
      : `${airport.icao ?? airport.title} airport`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  const street = geo
    ? [geo.road, geo.houseNumber].filter(Boolean).join(" ")
    : "";
  const city = facts?.municipality ?? geo?.city ?? null;
  const cityLine = [geo?.postcode, city].filter(Boolean).join(" ");
  const address = [street, cityLine].filter(Boolean).join(", ");
  const coords =
    lat != null && lon != null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : null;
  const website = facts?.homeLink ?? geo?.website ?? null;

  const rows: Array<[string, string]> = [];
  if (address) rows.push([t("address"), address]);
  if (coords) rows.push([t("coordinates"), coords]);
  if (geo?.phone) rows.push([t("phone"), geo.phone]);
  // On-field amenities from OpenAIP (null = unknown -> omit; we never assert
  // "no" from missing data, only when the facilities list exists but omits it).
  if (facts?.restaurant != null)
    rows.push([t("restaurant"), facts.restaurant ? t("yes") : t("no")]);
  if (facts?.customs != null)
    rows.push([t("customs"), facts.customs ? t("yes") : t("no")]);

  return (
    <section className="border border-[#ccc] bg-white p-4">
      <h2 className="text-center text-xl font-normal">{t("location")}</h2>

      {rows.length > 0 && (
        // Left-aligned label/value grid: the address wraps cleanly under its
        // value column instead of centering awkwardly on narrow screens.
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-drossgray-dark">{label}:</dt>
              <dd className="font-medium">{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}

      <div className="mt-3 flex flex-wrap justify-start gap-x-6 gap-y-1 text-sm">
        {website && (
          <ExternalLink
            href={website}
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
