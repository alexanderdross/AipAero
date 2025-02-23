'use client';

import { getPathname, localeLangMapping, usePathname } from "~/i18n/routing";
import { useSearchParams } from "next/navigation";
import { orgUrl } from "~/lib/utils";
import { useLocale } from "next-intl";

export function SchemaWebpage({ 
  nonEnglishLocale, 
  englishLocale 
} : {
  nonEnglishLocale: string;
  englishLocale: string;
}) {
  const pathname = usePathname();
  const currentLocale = useLocale();
  const searchParams = useSearchParams();
  const icao = Array.from(searchParams.entries()).at(0)?.at(0);
  const params = icao ? `?${icao}` : '';

  const schema = {
    "@context": "https://schema.org/",
    "@type": "WebPage",
    "potentialAction": {
      "@type": "Action",
      "target": [
        new URL(getPathname({ href: pathname, locale: currentLocale })+params, orgUrl).toString(),
        {
          "@type": "LinkRole",
          "target": new URL(getPathname({ href: pathname, locale: nonEnglishLocale })+params, orgUrl).toString(),
          "inLanguage": localeLangMapping[nonEnglishLocale],
          "linkRelationship": "alternate"
        },
        {
          "@type": "LinkRole",
          "target": new URL(getPathname({ href: pathname, locale: englishLocale })+params, orgUrl).toString(),
          "inLanguage": localeLangMapping[englishLocale],
          "linkRelationship": "alternate"
        }
      ]
    }
  }

  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />;
}