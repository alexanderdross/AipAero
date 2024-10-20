"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Translation } from "~/lib/i18n";
import { orgUrl } from "./metadata";

export default function Menu({ 
  translation 
}: { translation: Translation }) {
  const pathname = usePathname();
  const pages = [
    translation.CountryPage,
    translation.VfrPage,
    translation.IfrPage,
    translation.HeliportPage,
    translation.AirportsPage
  ].filter(x => x !== undefined);

  const navigationSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@context": "https://schema.org",
        "@type":"SiteNavigationElement",
        "name": "AIP Anflugkarten für Deutschland, Österreich, die Niederlande und UK",
        "alternateName": "AIP:Aero",
        "description":"AIP Anflugkarten VFR, IFR & Heliports für Deutschland, Österreich, die Niederlande und UK",
        "url": orgUrl.toString()
      },
      ...pages.map((page) => ({
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": page.title,
        "alternateName": page.menuTitle,
        "description": page.description,
        "url": new URL(page.href, orgUrl).toString(),
      })),
      {
        "@context": "https://schema.org",
        "@type":"SiteNavigationElement",
        "name": "Stratux - anti-collision system",
        "alternateName":"Dross:Aviation",
        "description":"Stratux, anti-collision system for private aviation and gliders",
        "url": "https://dross.net/aviation/?aip"
      }
    ]
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(navigationSchema)
        }}
      />
      <nav className="flex flex-wrap justify-center">
        {pages.map((page, idx) => (
          <span key={idx}>
            <Link
              href={page.href ?? ''}
              title={page.hrefTitle ?? ''}
              className={clsx('text-drossblue hover:underline mx-2', page.href === pathname && 'underline text-nowrap')}
              target="_self"
              rel="noopener"
            >
              {page.menuTitle}
            </Link>{idx < pages.length - 1 && '|'}
          </span>
        ))}
      </nav>
    </>
  );
}