interface Props {
  name: string;
  alternateName: string;
  description: string;
}

export function SchemaAirport({
  name,
  alternateName,
  description
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Airport",
    "name": name,
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