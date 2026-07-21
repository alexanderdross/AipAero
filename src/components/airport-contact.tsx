import { GlobeIcon, MapPinIcon, SendIcon, StampIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "~/components/external-link";
import { SectionHeading } from "~/components/section-heading";
import type { NormalizedFacts } from "~/lib/airport-facts";
import { borderCrossingForm } from "~/lib/border-crossing";
import { efbLinks } from "~/lib/efb-links";
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
  phone,
  lat,
  lon,
}: {
  airport: Airport;
  facts: NormalizedFacts | null;
  geo: GeoResult | null;
  /** Final resolved phone (OSM persisted > OSM live > AIP AD 2.2 OCR fallback),
   * computed once by the caller so the box and the Airport JSON-LD match. */
  phone: string | null;
  lat: number | null;
  lon: number | null;
}) {
  const t = await getTranslations("Common");

  const query =
    lat != null && lon != null
      ? `${lat},${lon}`
      : `${airport.icao ?? airport.title} airport`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  // Persisted D1 address (from the importer) first, live geocode as fallback.
  const street =
    facts?.street ??
    (geo ? [geo.road, geo.houseNumber].filter(Boolean).join(" ") : "");
  const postcode = facts?.postcode ?? geo?.postcode ?? null;
  const city = facts?.municipality ?? geo?.city ?? null;
  const cityLine = [postcode, city].filter(Boolean).join(" ");
  const address = [street, cityLine].filter(Boolean).join(", ");
  const coords =
    lat != null && lon != null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : null;
  const website = facts?.homeLink ?? geo?.website ?? null;

  const rows: Array<[string, ReactNode]> = [];
  if (address) rows.push([t("address"), address]);
  if (coords) rows.push([t("coordinates"), coords]);
  if (phone)
    rows.push([
      t("phone"),
      <a
        key="phone"
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        title={`${t("phone")}: ${phone}`}
        className="text-drossblue hover:underline"
      >
        {phone}
      </a>,
    ]);
  // On-field amenities from OpenAIP (null = unknown -> omit; we never assert
  // "no" from missing data, only when the facilities list exists but omits it).
  if (facts?.restaurant != null)
    rows.push([t("restaurant"), facts.restaurant ? t("yes") : t("no")]);
  if (facts?.customs != null)
    rows.push([t("customs"), facts.customs ? t("yes") : t("no")]);

  // National border-crossing form (verified official link, e.g. the UK GAR).
  // Country-level, not per-field: the UK GAR applies to every international
  // GA flight to/from the UK regardless of the field's customs designation.
  const borderForm = borderCrossingForm(airport.country);

  // EFB / pilot-tool hand-offs (verified ICAO deep-link patterns only).
  const efb = efbLinks(airport.icao);

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading
        className="text-center text-xl font-normal"
        linkTitle={`${t("location")} - ${airport.title}`}
      >
        {t("location")}
      </SectionHeading>

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
        {borderForm && (
          <ExternalLink
            href={borderForm.href}
            hrefTitle={`${t("borderCrossing")} (${borderForm.name})`}
            className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
          >
            <StampIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>
              {t("borderCrossing")} ({borderForm.name})
            </span>
          </ExternalLink>
        )}
      </div>

      {/* EFB / pilot-tool hand-offs: the same field opened in the tools a
          pilot plans with. ICAO-keyed deep links, so non-ICAO fields show
          nothing. Plain outbound links - no server data, no client JS. */}
      {efb.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-start gap-x-4 gap-y-1 text-sm">
          <span className="text-drossgray-dark inline-flex items-center gap-x-1">
            <SendIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {t("openIn")}:
          </span>
          {efb.map((link) => (
            <ExternalLink
              key={link.name}
              href={link.href}
              hrefTitle={`${airport.icao}: ${link.name}`}
              className="text-drossblue hover:underline"
            >
              {link.name}
            </ExternalLink>
          ))}
        </div>
      )}
    </section>
  );
}
