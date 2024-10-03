interface Props {
  alternateName: string;
  description: string;
}

export function SchemaAirport({
  alternateName,
  description
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Airport",
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