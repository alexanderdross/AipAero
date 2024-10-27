'use client';

import { ChevronRightIcon, HomeIcon } from "@heroicons/react/solid";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Translation } from "~/lib/i18n";
import { orgUrl } from "~/app/_components/metadata";

interface Props {
  airportTitle?: string;
  airportDescription?: string;
  translation: Translation;
}

export default function Breadcrumbs({
  airportTitle,
  airportDescription,
  translation
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const icaoParam = Array.from(searchParams.keys()).at(0);
  const breadcrumbs = pathname.split('/').filter(Boolean);
  if (!translation.isSingleLocale) {
    // Get index of "en" and join it with the preceding element inside the array
    const index = breadcrumbs.indexOf('en');
    if (index > -1) {
      breadcrumbs.splice(index - 1, 2, `${breadcrumbs[index - 1]}/${breadcrumbs[index]}`);
    }
  }
  const breadcrumbsOfIndex = (index: number) => `/${breadcrumbs.slice(0, index + 1).join('/')}/`;

  const pages = [
    translation.CountryPage,
    translation.VfrPage,
    translation.IfrPage,
    translation.HeliportPage,
    translation.AirportsPage
  ].filter(x => x !== undefined);

  const navItems = pages.map((key) => ({
    href: key.href,
    hrefTitle: key.hrefTitle,
    schemaTitle: key.title,
    title: key.breadcrumbTitle,
    alternateName: key.menuTitle,
    description: key.countryPageDescription ?? key.description
  }));

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": {
          "@id": orgUrl.toString(),
          "name": "AIP approach charts VFR, IFR & Heliports",
          "alternateName": "AIP:Aero",
          "description": "AIP approach charts VFR, IFR & Heliports"
        }
      },
      ...breadcrumbs.map((breadcrumb, index) => {
        const currentNavItem = navItems.find(e => breadcrumbsOfIndex(index) === e.href);
        const href = currentNavItem?.href ?? breadcrumbsOfIndex(index);
        const title = currentNavItem?.schemaTitle ?? breadcrumb.toLocaleUpperCase();
        let alternateName = currentNavItem?.hrefTitle ?? breadcrumb.toLocaleUpperCase();
        if (index === breadcrumb.length - 1) {
          alternateName = translation.AirportsPage.description;
        }
        const description = currentNavItem?.description ?? breadcrumb.toLocaleUpperCase();
        const item = {
          "@type": "ListItem",
          "position": index + 2,
          "item": {
            "@id": new URL(href, orgUrl).toString(),
            "name": title,
            "alternateName": alternateName,
            "description": description
          }
        };
        return item;
      })
    ]
  }

  if (icaoParam && airportTitle && airportDescription) {
    breadcrumbsSchema.itemListElement.push({
      "@type": "ListItem",
      "position": breadcrumbs.length + 2,
      "item": {
        "@id": new URL(pathname, orgUrl).toString() + `?${icaoParam}`,
        "name": airportTitle,
        "alternateName": icaoParam,
        "description": airportDescription
      }
    });
  }

  return (<>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(breadcrumbsSchema)
      }}
    />

    <nav className="flex justify-center py-6 mt-8">
      <ol className="flex items-center space-x-4">
        <li>
          <div>
            <Link
              href="/"
              title="AIP Home"
              className="text-drossgray-dark hover:text-drossblue"
              target="_self"
              rel="noopener"
            >
              <HomeIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
              <span className="sr-only">AIP Home</span>
            </Link>
          </div>
        </li>

        {breadcrumbs.map((breadcrumb, index) => {
          const currentNavItem = navItems.find(e => breadcrumbsOfIndex(index) === e.href);
          const href = currentNavItem?.href ?? breadcrumbsOfIndex(index);
          const hrefTitle = currentNavItem?.hrefTitle ?? breadcrumb.toLocaleUpperCase();
          const title = currentNavItem?.title ?? breadcrumb.toLocaleUpperCase();

          return (<li key={breadcrumb}>
            <div className="flex items-center">
              <ChevronRightIcon className="flex-shrink-0 h-5 w-5 text-drossgray-dark" aria-hidden="true" />
              <Link
                href={href}
                title={hrefTitle}
                className="ml-4 text-sm font-medium text-drossgray-dark hover:text-drossblue"
                aria-current={index === breadcrumbs.length - 1 && !icaoParam ? 'page' : undefined}
                target="_self"
                rel="noopener"
              >
                {title}
              </Link>
            </div>
          </li>);
        })}

        {icaoParam && airportTitle && airportDescription && <li>
          <div className="flex items-center">
            <ChevronRightIcon className="flex-shrink-0 h-5 w-5 text-drossgray-dark" aria-hidden="true" />
            <Link
              href={new URL(navItems.at(-1)?.href ?? '', orgUrl).toString() + `?${icaoParam}`}
              title={airportTitle}
              className="ml-4 text-sm font-medium text-drossgray-dark hover:text-drossblue"
              aria-current={'page'}
              target="_self"
              rel="noopener"
            >
              {icaoParam}
            </Link>
          </div>
        </li>}
      </ol>
    </nav>
  </>);
}