'use client';

import { usePathname } from "next/navigation";
import { orgUrl } from "~/app/_components/metadata";

export function SchemaWebsite() {
  const pathname = usePathname();
  const url = new URL(pathname, orgUrl)
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": url.toString(),
    "potentialAction": {
      "@type": "SearchAction",
      "target": new URL(`${pathname}?{query}`, orgUrl).toString(),
      "query": "required",
      "query-input": "required maxlength=50 name=query"
    }
  }

  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />;
}