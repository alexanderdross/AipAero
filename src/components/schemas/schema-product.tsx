import { orgLogoSquareUrl, orgLogoUrl } from "~/lib/utils";
import dayjs from "dayjs";

interface Props {
  name: string;
  alternateName: string;
  description: string;
  publishedDate: Date;
  currentUrl: string;
  /**
   * Cross-type sibling pages of the same airport (e.g. the IFR page from the
   * VFR page and vice versa), emitted as `isRelatedTo` Product references so
   * the structured data mirrors the visible cross-type links.
   */
  related?: { url: string; name: string }[];
}

export function SchemaProduct({
  name,
  alternateName,
  description,
  publishedDate,
  currentUrl,
  related,
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    ...(related && related.length > 0
      ? {
          isRelatedTo: related.map((r) => ({
            "@type": "Product",
            "@id": r.url,
            url: r.url,
            name: r.name,
          })),
        }
      : {}),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "247",
      reviewCount: "247",
      bestRating: "5",
      worstRating: "1",
    },
    name: name,
    alternateName: alternateName,
    description: description,
    url: currentUrl,
    image: [
      {
        "@type": "ImageObject",
        url: orgLogoSquareUrl.toString(),
        width: 450,
        height: 450,
      },
      {
        "@type": "ImageObject",
        url: orgLogoUrl.toString(),
        width: 446,
        height: 319,
      },
    ],
    logo: [
      {
        "@type": "ImageObject",
        url: orgLogoSquareUrl.toString(),
        width: 450,
        height: 450,
      },
      {
        "@type": "ImageObject",
        url: orgLogoUrl.toString(),
        width: 446,
        height: 319,
      },
    ],
    review: {
      "@type": "Review",
      author: {
        "@type": "Person",
        name: "Alexander Dross",
        url: "https://dross.net/alexander/",
      },
      datePublished: dayjs(publishedDate).format("YYYY-MM-DD"),
      additionalType: [
        "https://dross.net/alexander/",
        "https://dross.net/media/",
        "https://dross.net/air/",
        "https://dross.net/alexander/blog/",
        "https://trade.aero/",
        "https://aip.aero/",
        "https://dross.net/aviation/?aip",
      ],
      reviewRating: {
        "@type": "Rating",
        bestRating: "5",
        ratingValue: "4.9",
        worstRating: "1",
      },
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
