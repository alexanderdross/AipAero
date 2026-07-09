interface Props {
  name: string;
  icaoCode?: string | null;
  alternateName: string;
  description: string;
  url: string;
  // Optional facts, merged in when the server-rendered aerodrome-data / location
  // boxes have them (see `AirportGadgets`). schema.org/Airport supports geo,
  // elevation and a postal address, so we enrich the node with the same data the
  // boxes display - one fetch feeds both.
  latitude?: number | null;
  longitude?: number | null;
  elevationFt?: number | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  telephone?: string | null;
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
