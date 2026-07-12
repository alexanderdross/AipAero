import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { getPathname, type Locale, type Pathnames } from "~/i18n/routing";
import { orgUrl, rootBreadcrumb } from "~/lib/utils";

/**
 * Server-rendered breadcrumb bar + its BreadcrumbList JSON-LD, built from ONE
 * data structure so the visible trail and the schema can never drift apart.
 *
 * Rendered by the PAGES (not the layout): only the pages know their own
 * hierarchy level and, on the detail routes, the real airport row - which is
 * why the last crumb can show the proper ICAO (or, for non-ICAO fields, the
 * real title) instead of a re-capitalized slug guess. Because it is plain SSR
 * HTML, the links exist in every served document - the former client
 * component (useSearchParams) never appeared in the prerendered HTML of the
 * static pages at all. Zero client JS; the links are plain <a> (a breadcrumb
 * click is a rare, full-navigation-worthy action - no per-page prefetch
 * cost). The bar stays at the BOTTOM of the page above the footer (owner
 * decision: no above-the-fold cost), never wraps, and scrolls horizontally
 * on overflow (hidden scrollbar; mx-auto w-max centers short trails).
 */

type SchemaFields = {
  /** schema.org item name; falls back to the visible label when omitted. */
  name?: string;
  alternateName?: string;
  description?: string;
};

/** The current page's own crumb (omit on the country landing page). */
export type PageCrumb = SchemaFields & { href: Pathnames };

/** The airport crumb on detail pages (?ICAO); always the current page. */
export type AirportCrumb = SchemaFields & {
  /** Canonical detail URL (".../vfr?EDDF") - used as the schema @id. */
  url: string;
  /** Visible label: the ICAO code, or the real title for non-ICAO fields. */
  label: string;
};

export async function BreadCrumbs({
  locale,
  page,
  airport,
}: {
  locale: string;
  page?: PageCrumb;
  airport?: AirportCrumb;
}) {
  const t = await getTranslations("BreadCrumbs");
  const tCountry = await getTranslations("CountryPage");

  const countryPath = getPathname({ href: "/", locale: locale as Locale });
  const countryUrl = new URL(countryPath, orgUrl).toString() + "/";

  const entries: {
    label: string;
    /** Relative link target (trailing-slash canonical); current crumb: none. */
    href?: string;
    titleAttr?: string;
    /** Absolute URL for the schema @id. */
    url: string;
    schema: SchemaFields;
  }[] = [
    {
      label: t("root.title"),
      href: "/",
      titleAttr: t("root.hrefTitle"),
      url: orgUrl.toString(),
      schema: rootBreadcrumb.item,
    },
    {
      label: t("/.title"),
      href: countryPath + "/",
      titleAttr: t("/.hrefTitle"),
      url: countryUrl,
      schema: {
        name: tCountry("breadcrumb.name"),
        alternateName: tCountry("breadcrumb.alternateName"),
        description: tCountry("breadcrumb.description"),
      },
    },
  ];
  if (page) {
    const pagePath = getPathname({ href: page.href, locale: locale as Locale });
    entries.push({
      label: t(`${page.href}.title`),
      href: pagePath + "/",
      titleAttr: t(`${page.href}.hrefTitle`),
      // No trailing slash on the @id - matches the schema the pages emitted
      // before this component existed (already-indexed structured data).
      url: new URL(pagePath, orgUrl).toString(),
      schema: page,
    });
  }
  if (airport) {
    entries.push({ label: airport.label, url: airport.url, schema: airport });
  }
  // The trail's last entry is the current page: no link, aria-current below.
  delete entries[entries.length - 1]!.href;

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((e, i) =>
      i === 0
        ? rootBreadcrumb
        : {
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@id": e.url,
              name: e.schema.name ?? e.label,
              ...(e.schema.alternateName && {
                alternateName: e.schema.alternateName,
              }),
              ...(e.schema.description && {
                description: e.schema.description,
              }),
            },
          },
    ),
  };

  return (
    <>
      {/* Never wraps: a second line would change the bar height and shift the
          footer (CLS). Overflow scrolls horizontally instead - same pattern
          as the mobile pill nav. */}
      <div className="[scrollbar-width:none] overflow-x-auto px-4 py-8 sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
        <nav aria-label={t("label")} className="mx-auto w-max">
          <ol className="text-drossgray-dark flex items-center gap-1.5 text-sm whitespace-nowrap sm:gap-2.5">
            {entries.map((e, i) => (
              <Fragment key={e.url}>
                {i > 0 && (
                  <li role="presentation" aria-hidden="true">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </li>
                )}
                <li className="inline-flex items-center">
                  {e.href ? (
                    <a
                      href={e.href}
                      title={e.titleAttr}
                      className="text-foreground/80 transition-colors hover:underline"
                    >
                      {e.label}
                    </a>
                  ) : (
                    <span aria-current="page" className="text-foreground">
                      {e.label}
                    </span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsSchema) }}
      />
    </>
  );
}
