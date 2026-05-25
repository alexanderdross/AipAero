"use client";

import { usePathname } from "next/navigation";
import { orgUrl } from "~/lib/utils";

export function SchemaWebsite() {
  const pathname = usePathname();
  const url = new URL(pathname, orgUrl).toString();
  const target = new URL(`${pathname}?{query}`, orgUrl).toString();

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: url,
    potentialAction: {
      "@type": "SearchAction",
      target: target,
      query: "required",
      "query-input": "required maxlength=50 name=query",
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
