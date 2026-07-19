import type { OpeningHoursSpecification } from "~/lib/opening-hours";

interface Props {
  name: string;
  icaoCode?: string | null;
  alternateName: string;
  description: string;
  url: string;
  // Optional facts, merged in when the server-rendered aerodrome-data / location
  // boxes have them (see `AirportGadgets`). schema.org/Airport (a Place) supports
  // geo, elevation, a postal address, telephone, sameAs and additionalProperty,
  // so we surface EVERY item the two boxes display inside the JSON-LD - the same
  // getAirportFacts fetch feeds both, so the structured data can't diverge.
  latitude?: number | null;
  longitude?: number | null;
  elevationFt?: number | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  telephone?: string | null;
  // Official airport website (OurAirports/OpenAIP) -> schema.org `sameAs`.
  sameAs?: string | null;
  // Google Maps link for the field -> schema.org `hasMap` (a map of the place).
  hasMap?: string | null;
  // Structured operation hours -> schema.org `openingHoursSpecification`
  // (canonical, machine-readable), generated from the field's structured hours.
  // Empty -> omitted; the free-text "Opening hours" PropertyValue is the
  // fallback for fields with only unstructured hours.
  openingHoursSpecification?: OpeningHoursSpecification[];
  // Every remaining aerodrome/location datum with no first-class schema.org
  // property (aerodrome type, runway surface, fuel, PPR, opening hours, runways,
  // frequencies, restaurant, customs) as PropertyValue entries.
  additionalProperties?: Array<{ name: string; value: string }>;
}

export function SchemaAirport({
  name,
  icaoCode,
  alternateName,
  description,
  url,
  latitude,
  longitude,
  elevationFt,
  street,
  postalCode,
  city,
  telephone,
  sameAs,
  hasMap,
  openingHoursSpecification,
  additionalProperties,
}: Props) {
  const geo =
    latitude != null && longitude != null
      ? {
          "@type": "GeoCoordinates",
          latitude,
          longitude,
          // schema.org elevation: metres (ISO 80000), derived from feet.
          ...(elevationFt != null
            ? { elevation: `${Math.round(elevationFt * 0.3048)}` }
            : {}),
        }
      : undefined;

  const address =
    (street ?? postalCode ?? city)
      ? {
          "@type": "PostalAddress",
          ...(street ? { streetAddress: street } : {}),
          ...(postalCode ? { postalCode } : {}),
          ...(city ? { addressLocality: city } : {}),
        }
      : undefined;

  const additionalProperty = additionalProperties?.length
    ? additionalProperties.map((p) => ({
        "@type": "PropertyValue",
        name: p.name,
        value: p.value,
      }))
    : undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Airport",
    name: name,
    icaoCode: icaoCode,
    url: url,
    alternateName: alternateName,
    description: description,
    ...(geo ? { geo } : {}),
    ...(address ? { address } : {}),
    ...(telephone ? { telephone } : {}),
    ...(sameAs ? { sameAs } : {}),
    ...(hasMap ? { hasMap } : {}),
    ...(openingHoursSpecification?.length ? { openingHoursSpecification } : {}),
    ...(additionalProperty ? { additionalProperty } : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  );
}
