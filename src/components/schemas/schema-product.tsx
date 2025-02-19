'use client';

import { usePathname } from "next/navigation";
import { orgLogoSquareUrl, orgLogoUrl, orgUrl } from "~/lib/utils";
import dayjs from "dayjs";

interface Props {
  name: string;
  alternateName: string;
  description: string;
  publishedDate: Date;
  icaoParam?: string;
}

export function SchemaProduct({ 
  name, 
  alternateName, 
  description,
  icaoParam,
  publishedDate
}: Props) {
  const pathname = usePathname();
  let url = new URL(pathname, orgUrl).toString();
  if (icaoParam) {
    url += `?${icaoParam}`;
    alternateName += ` ${icaoParam}`;
  }

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
    "url": url,
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
      "datePublished": dayjs(publishedDate).format('YYYY-MM-DD'),
      "additionalType": [
        "https://dross.net/alexander/",
        "https://dross.net/media/",
        "https://dross.net/air/",
        "https://dross.net/alexander/blog/",
        "https://trade.aero/",
        "https://aip.aero/",
        "https://dross.net/aviation/?aip"
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