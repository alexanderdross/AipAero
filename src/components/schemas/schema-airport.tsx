interface Props {
  name: string;
  icaoCode?: string | null;
  alternateName: string;
  description: string;
  url: string;
}

export function SchemaAirport({
  name,
  icaoCode,
  alternateName,
  description,
  url,
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Airport",
    name: name,
    icaoCode: icaoCode,
    url: url,
    alternateName: alternateName,
    description: description,
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
