'use client';

import { usePathname, useSearchParams } from "next/navigation";
import { orgUrl } from "~/app/_components/metadata";

interface Props {
  name: string;
  icaoCode: string;
  alternateName: string;
  description: string;
}

export function SchemaAirport({
  name,
  icaoCode,
  alternateName,
  description
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const icao = Array.from(searchParams.keys()).length === 1 ? `?${Array.from(searchParams.keys())[0]}` : '';

  const schema = {
    "@context": "https://schema.org",
    "@type": "Airport",
    "name": name,
    "icaoCode": icaoCode,
    "url": new URL(pathname+icao, orgUrl).toString(),
    "alternateName": alternateName,
    "description": description
  };
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />;
}