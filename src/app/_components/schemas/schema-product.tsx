import { orgLogoSquareUrl, orgLogoUrl, orgUrl } from "../metadata";

interface Props {
  name: string;
  alternateName: string;
  description: string;
  href?: string;
}

export function SchemaProduct({ 
  name, alternateName, description, href 
}: Props) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "247",
      "reviewCount": "247",
      "bestRating": "5",
      "worstRating": "1"
    },
    "name": name,
    "alternateName": alternateName,
    "description": description,
    "url": href ? (new URL(href, orgUrl)).toString() : orgUrl.toString(),
    "image": [{
      "@type": "ImageObject",
      "url": orgLogoSquareUrl.toString(),
      "width": 450,
      "height": 450
    },
    {
      "@type": "ImageObject",
      "url": orgLogoUrl.toString(),
      "width": 446,
      "height": 319
    }],
    "logo": [{
      "@type": "ImageObject",
      "url": orgLogoSquareUrl.toString(),
      "width": 450,
      "height": 450
    },
    {
      "@type": "ImageObject",
      "url": orgLogoUrl.toString(),
      "width": 446,
      "height": 319
    }],
    "review": {
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": "Alexander Dross",
        "url": "https://dross.net/alexander/"
      },
      "datePublished": "2024-07-19",
      "additionalType": [
        "https://dross.net/alexander/",
        "https://dross.net/media/",
        "https://dross.net/air/",
        "https://dross.net/alexander/blog/",
        "https://dross.net/alexander/feed",
        "https://aip.aero/",
        "https://dross.net/aviation/"
      ],
      "reviewRating": {
        "@type": "Rating",
        "bestRating": "5",
        "ratingValue": "4.9",
        "worstRating": "1"
      }
    }
  };
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />;
}