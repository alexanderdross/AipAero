interface Props {
  name: string;
  alternateName: string;
  description: string;
  /** The chart PDF itself. */
  url: string;
  /** The aip.aero airport-detail page the chart belongs to. */
  isPartOfUrl: string;
}

/**
 * JSON-LD for the airport's approach-chart PDF as a `schema.org/DigitalDocument`,
 * so search engines see the chart as a standalone document that is part of the
 * airport-detail page. Rendered only where a PDF chart exists (gated by
 * `isPdfUrl` in `AirportGadgets`), so `encodingFormat` is always application/pdf.
 */
export function SchemaDigitalDocument({
  name,
  alternateName,
  description,
  url,
  isPartOfUrl,
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "DigitalDocument",
    name: name,
    alternateName: alternateName,
    description: description,
    url: url,
    encodingFormat: "application/pdf",
    isPartOf: {
      "@type": "WebPage",
      "@id": isPartOfUrl,
      url: isPartOfUrl,
    },
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
