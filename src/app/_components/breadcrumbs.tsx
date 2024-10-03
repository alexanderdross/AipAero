'use client';

import { ChevronRightIcon, HomeIcon } from "@heroicons/react/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Translation } from "~/lib/i18n";
import { orgUrl } from "~/app/_components/metadata";

export default function Breadcrumbs({ translation }: { translation: Translation }) {
  const pathname = usePathname();
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
    title: key.breadcrumbTitle,
    alternateName: key.menuTitle,
    description: key.description
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
      ...breadcrumbs?.map((breadcrumb, index) => {
        const currentNavItem = navItems.find(e => breadcrumbsOfIndex(index) === e.href);
        const href = currentNavItem?.href ?? breadcrumbsOfIndex(index);
        const title = currentNavItem?.title ?? breadcrumb.toLocaleUpperCase();
        const alternateName = currentNavItem?.alternateName ?? breadcrumb.toLocaleUpperCase();
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
      })]
  }

  return (<>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(breadcrumbsSchema)
      }}
    />
    <div className="max-w-7xl mx-auto pt-4 px-4 overflow-hidden sm:px-6 lg:px-8">
      <nav className="flex justify-center border border-[#ccc] p-4">
        <ol role="list" className="flex items-center space-x-4">
          <li>
            <div>
              <Link
                href="/"
                title="AIP Home"
                className="text-gray-400 hover:text-gray-500"
                target="_self"
                rel="noopener"
              >
                <HomeIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                <span className="sr-only">AIP Home</span>
              </Link>
            </div>
          </li>
          {breadcrumbs?.map((breadcrumb, index) => {
            const currentNavItem = navItems.find(e => breadcrumbsOfIndex(index) === e.href);
            const href = currentNavItem?.href ?? breadcrumbsOfIndex(index);
            const hrefTitle = currentNavItem?.hrefTitle ?? breadcrumb.toLocaleUpperCase();
            const title = currentNavItem?.title ?? breadcrumb.toLocaleUpperCase();

            return (<li key={breadcrumb}>
              <div className="flex items-center">
                <ChevronRightIcon className="flex-shrink-0 h-5 w-5 text-gray-400" aria-hidden="true" />
                <Link
                  href={href}
                  title={hrefTitle}
                  className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                  aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                  target="_self"
                  rel="noopener"
                >
                  {title}
                </Link>
              </div>
            </li>);
          })}
        </ol>
      </nav>
    </div>
  </>);
}