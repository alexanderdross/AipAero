interface Props {
  name: string;
  icaoCode: string;
  alternateName: string;
  description: string;
}

export function SchemaAirport({
  name,
  icaoCode,
  alternateName,
  description
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Airport",
    "name": name,
    "icaoCode": icaoCode,
    "alternateName": alternateName,
    "description": description
  };
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />;
}