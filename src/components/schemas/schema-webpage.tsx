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
  
  function trailingSlash(url: string) {
    return url.endsWith('/') ? url : url + '/';
  }

  const schema = {
    "@context": "https://schema.org/",
    "@type": "WebPage",
    "potentialAction": {
      "@type": "Action",
      "target": [
        trailingSlash(new URL(getPathname({ href: pathname, locale: currentLocale }), orgUrl).toString())+params,
        {
          "@type": "LinkRole",
          "target": trailingSlash(new URL(getPathname({ href: pathname, locale: nonEnglishLocale }), orgUrl).toString())+params,
          "inLanguage": localeLangMapping[nonEnglishLocale],
          "linkRelationship": "alternate"
        },
        {
          "@type": "LinkRole",
          "target": trailingSlash(new URL(getPathname({ href: pathname, locale: englishLocale }), orgUrl).toString())+params,
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