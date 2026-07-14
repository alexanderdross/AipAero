import { chartDisplayName, type ChartLink } from "~/lib/charts";

interface Props {
  name: string;
  alternateName: string;
  description: string;
  /** The chart PDF itself. */
  url: string;
  /** The aip.aero airport-detail page the chart belongs to. */
  isPartOfUrl: string;
  /** AIRAC/publication effective date (ISO), when derivable from the URL. */
  datePublished?: string | null;
  /** The source's full chart list; emitted as hasPart DigitalDocuments. */
  charts?: ChartLink[];
  /** UI language, so hasPart names spell out the ICAO chart-type codes. */
  lang: string;
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
  datePublished,
  charts,
  lang,
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "DigitalDocument",
    name: name,
    alternateName: alternateName,
    description: description,
    url: url,
    encodingFormat: "application/pdf",
    ...(datePublished && { datePublished }),
    isPartOf: {
      "@type": "WebPage",
      "@id": isPartOfUrl,
      url: isPartOfUrl,
    },
    // The source's other charts for this field (SIDs/STARs/IACs...), each a
    // DigitalDocument of its own, named by the source's designation.
    ...(charts &&
      charts.length > 1 && {
        hasPart: charts
          .filter((c) => c.url !== url)
          .map((c) => ({
            "@type": "DigitalDocument",
            name: chartDisplayName(c.name, lang),
            url: c.url,
            encodingFormat: "application/pdf",
          })),
      }),
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
