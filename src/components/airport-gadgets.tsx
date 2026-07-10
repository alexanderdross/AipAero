import pick from "lodash/pick";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AirportChart } from "~/components/airport-chart";
import { AirportContact } from "~/components/airport-contact";
import { AirportFacts } from "~/components/airport-facts";
import { AirportNearby } from "~/components/airport-nearby";
import { AirportWeatherWind } from "~/components/airport-weather-wind";
import { SchemaAirport } from "~/components/schemas/schema-airport";
import { SaveOfflineButton } from "~/components/save-offline-button";
import { SchemaDigitalDocument } from "~/components/schemas/schema-digital-document";
import { TradeAeroCta } from "~/components/trade-aero-cta";
import { localeLangMapping } from "~/i18n/routing";
import { aerodromeTypeLabel } from "~/lib/aerodrome-type";
import { getAirportFacts } from "~/lib/airport-facts";
import { forwardGeocode, reverseGeocode } from "~/lib/geocode";
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
  const [locale, messages, facts, tCommon] = await Promise.all([
    getLocale(),
    getMessages(),
    getAirportFacts(airport.icao),
    getTranslations("Common"),
  ]);

  let lat = facts?.lat ?? null;
  let lon = facts?.lon ?? null;

  // ICAO-less fields (hospital / private helipads) have no ICAO-keyed facts
  // source, so no coordinates - which would leave the weather, nearby and
  // sun-time gadgets empty. Fall back to geocoding the field name so those
  // coordinate-driven boxes still work (approximate; fail-soft).
  if (lat == null || lon == null) {
    const geocoded = await forwardGeocode(airport.title, airport.country);
    if (geocoded) {
      lat = geocoded.lat;
      lon = geocoded.lon;
    }
  }

  // The postal address is persisted in D1 once the importer has backfilled it;
  // only geocode live (Nominatim) as a fallback for ICAOs that have none stored.
  const hasStoredAddress =
    facts?.street != null || facts?.postcode != null || facts?.phone != null;
  const geo =
    !hasStoredAddress && lat != null && lon != null
      ? await reverseGeocode(lat, lon)
      : null;
  const openingHours = facts?.openingHours ?? geo?.openingHours ?? null;
  const street =
    facts?.street ??
    (geo
      ? [geo.road, geo.houseNumber].filter(Boolean).join(" ") || null
      : null);
  const postcode = facts?.postcode ?? geo?.postcode ?? null;
  const city = facts?.municipality ?? geo?.city ?? null;
  const phone = facts?.phone ?? geo?.phone ?? null;
  const website = facts?.homeLink ?? geo?.website ?? null;
  // Same Google Maps link the location box renders (coords when known, else the
  // ICAO/name) -> schema.org `hasMap`.
  const mapQuery =
    lat != null && lon != null
      ? `${lat},${lon}`
      : `${airport.icao ?? airport.title} airport`;
  const hasMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapQuery,
  )}`;

  // Every remaining item of the two boxes with no first-class schema.org field,
  // as PropertyValue entries so the Airport JSON-LD mirrors what is displayed.
  const lang = localeLangMapping[locale] ?? "en";
  const runways = facts?.runways ?? [];
  const surfaces = [...new Set(runways.map((r) => r.surface).filter(Boolean))];
  const props: Array<{ name: string; value: string }> = [];
  const addProp = (name: string, value: string | null | undefined) => {
    if (value) props.push({ name, value });
  };
  addProp("Aerodrome type", aerodromeTypeLabel(facts?.aerodromeType, lang));
  addProp("Runway surface", surfaces.join(", "));
  addProp("Fuel", facts?.fuel.length ? facts.fuel.join(", ") : null);
  if (facts?.ppr != null) addProp("PPR", facts.ppr ? "Yes" : "No");
  addProp("Opening hours", openingHours);
  addProp(
    "Runways",
    runways
      .map((r) =>
        [r.ident, r.lengthFt ? `${r.lengthFt} ft` : null, r.surface]
          .filter(Boolean)
          .join(" "),
      )
      .join("; ") || null,
  );
  addProp(
    "Frequencies",
    (facts?.frequencies ?? [])
      .map((f) => `${f.type} ${f.mhz}`.trim())
      .join("; ") || null,
  );
  if (facts?.restaurant != null)
    addProp("Restaurant", facts.restaurant ? "Yes" : "No");
  if (facts?.customs != null) addProp("Customs", facts.customs ? "Yes" : "No");

  return (
    // min-h matches the streaming fallback (AirportGadgetsFallback): reserving a
    // consistent height for the whole gadget region keeps the footer from
    // shifting when the fallback is replaced AND when the lazy client weather box
    // later appears or collapses (both happen within the reserved height). Fields
    // taller than this (e.g. with a PDF chart) still grow past it; sparse fields
    // get a little trailing whitespace. Keep this value in sync with the fallback.
    <div className="mx-auto mt-24 min-h-[40rem] max-w-7xl px-4 sm:px-6 lg:px-8">
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
        postalCode={postcode}
        city={city}
        telephone={phone}
        sameAs={website}
        hasMap={hasMap}
        additionalProperties={props}
      />
      <div className="flex flex-col gap-4">
        {/* Explicit "save for offline" (PWA Phase 3): pins this page (and a
            direct-PDF chart) in the never-trimmed offline caches. */}
        <SaveOfflineButton
          slug={airport.slug}
          title={airport.title}
          chartUrl={isPdfUrl(airport.url) ? airport.url : null}
          saveLabel={tCommon("saveOffline")}
          savedLabel={tCommon("savedOffline")}
          installHintLabel={tCommon("installHint")}
        />
        {isPdfUrl(airport.url) && (
          <>
            <AirportChart url={airport.url} />
            {/* Structured-data twin of the chart box: marks the PDF up as a
                DigitalDocument that is part of this airport page. */}
            <SchemaDigitalDocument
              name={schemaName}
              alternateName={schemaAlternateName}
              description={schemaDescription}
              url={airport.url}
              isPartOfUrl={schemaUrl}
            />
          </>
        )}
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
            lat={lat}
            lon={lon}
          />
        </div>
        {/* Trade:Aero cross-sell (locale + country aware), above the weather
            box - same discreet SSR text CTA as on the country / list pages. */}
        <TradeAeroCta />
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
