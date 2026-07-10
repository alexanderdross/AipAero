import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { Fragment } from "react";
import { AboutBox } from "~/components/about-box";
import { Box } from "~/components/box";
import { GlobalSearchInputField } from "~/components/global-search-input-field";
import Footer from "~/components/footer";
import { Hero } from "~/components/hero";
import { Header } from "~/components/header";
import { ValueProps } from "~/components/value-props";
import {
  countryMeta,
  countryTypeAvailability,
  liveCountries,
  orgUrl,
  rootBreadcrumb,
  rootDescription,
  rootTitle,
} from "~/lib/utils";
import { SchemaProduct } from "~/components/schemas/schema-product";
import { ServiceWorkerRegistration } from "~/components/service-worker-registration";
import { modifiedDate as buildDate } from "~/lib/build-info";
import { inter } from "~/lib/fonts";
import { isSingleLocale, routing } from "~/i18n/routing";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";

export async function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  return {
    title: `🛩️ ${rootTitle}`,
    description: `🛩️ ${rootDescription}`,
    alternates: {
      canonical: orgUrl,
      languages: {
        "x-default": orgUrl,
      },
    },
    openGraph: {
      ...previousOpenGraph,
      url: orgUrl.toString(),
      siteName: `🛩️ ${rootTitle}`,
    },
    other: {
      ...(previousOther as Omit<
        Metadata["other"],
        keyof DeprecatedMetadataFields
      >),
      "twitter:url": orgUrl.toString(),
      abstract: `🛩️ ${rootDescription}`,
      "og:image:alt": rootTitle,
    },
  };
}

export default async function RootPage() {
  setRequestLocale("uk");

  // Only live countries appear in the SiteNavigation JSON-LD (hidden countries
  // must not be advertised to crawlers while their pages are empty).
  const liveLocales = routing.locales.filter((x) =>
    liveCountries.includes(x.replace("-EN", "")),
  );
  const localeTranslations = await Promise.all(
    liveLocales.map((x) =>
      getTranslations({ locale: x, namespace: "CountrySiteNavElement" }),
    ),
  );
  const localeElements = localeTranslations.map((x) => ({
    name: x("name"),
    alternateName: x("alternateName"),
    description: x("description"),
    inLanguage: x("inLanguage"),
    url: x("url"),
  }));

  // Country cards derive from `liveCountries` x `countryMeta` (~/lib/utils):
  // launching a country is a single un-comment in `liveCountries`, no edit
  // here. Single-locale countries (uk, be) get one button and no /en/ twin.
  const countries = liveCountries
    .map((tld) => ({
      tld,
      ...countryMeta[tld]!,
      isSingleLocale: isSingleLocale(tld),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Short, language-neutral labels for the chart types each country exposes,
  // shown as pills on its card so the grid hints at what is behind each link.
  const typeBadge: Record<string, string> = {
    vfr: "VFR",
    ifr: "IFR",
    heliport: "Heliport",
    mil: "Military",
    aeroport: "Aéroport",
  };

  const modifiedDate = new Date(buildDate);

  return (
    <html className={`h-full ${inter.variable}`} lang="en">
      {/* We cant set the alternate links via metadata api, since it disallows the use of duplicate hrefLang */}
      <head>
        {countries.map((e) => (
          <link
            key={e.name}
            rel="alternate"
            hrefLang={e.lang}
            href={`https://aip.aero/${e.tld}/`}
          />
        ))}
        {countries
          .filter((e) => !e.isSingleLocale)
          .map((e) => (
            <link
              key={e.name}
              rel="alternate"
              hrefLang="en"
              href={`https://aip.aero/${e.tld}/en/`}
            />
          ))}
      </head>

      <body className={"bg-drossgray font-sans"}>
        <Header />

        <main>
          {/* Sitelinks Search Box: Google may render a search box under the
              site's search result. The target URL must execute the search -
              the VALUELESS query key (https://aip.aero/?EDNY, the site's SEO
              scheme, same as the ?ICAO airport-detail URLs) is picked up by
              GlobalSearchInputField on mount. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": `${orgUrl.toString()}#website`,
                url: orgUrl.toString(),
                name: "AIP:Aero",
                alternateName: rootTitle,
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    // orgUrl carries the trailing slash: https://aip.aero/?...
                    urlTemplate: `${orgUrl.toString()}?{search_term_string}`,
                  },
                  // maxlength mirrors the server action's search validation.
                  "query-input":
                    "required maxlength=50 name=search_term_string",
                },
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [rootBreadcrumb],
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                // One multi-typed node: the homepage navigation
                // (SiteNavigationElement), the collection (CollectionPage) and
                // the ordered ItemList that carries the per-country nav entries.
                "@type": [
                  "SiteNavigationElement",
                  "CollectionPage",
                  "ItemList",
                ],
                name: rootTitle,
                url: orgUrl.toString(),
                itemListElement: [
                  {
                    "@type": "SiteNavigationElement",
                    position: 1,
                    name: rootTitle,
                    alternateName: "AIP:Aero",
                    description: rootDescription,
                    inLanguage: "en",
                    url: orgUrl.toString(),
                  },
                  ...localeElements.map((x, i) => ({
                    "@type": "SiteNavigationElement",
                    position: i + 2,
                    name: x.name,
                    alternateName: x.alternateName,
                    description: x.description,
                    inLanguage: x.inLanguage,
                    url: x.url,
                  })),
                ],
              }),
            }}
          />
          <SchemaProduct
            name={rootTitle}
            alternateName="AIP:Aero"
            description={rootDescription}
            publishedDate={modifiedDate}
            currentUrl={orgUrl.toString()}
          />

          {/* Hero: headline plus the global cross-country search as the
              primary call to action. */}
          <Hero title={rootTitle} description={rootDescription}>
            <GlobalSearchInputField placeholder="Search any airport across Europe by name or ICAO code" />
          </Hero>

          {/* Trust strip */}
          <ValueProps />

          {/* Country Boxes */}
          <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div
              className={"grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"}
            >
              {countries.map((e) => (
                <Box
                  key={e.name}
                  lang="en"
                  icon={<span className="text-3xl">{e.flag}</span>}
                  title={`AIP ${e.name}`}
                  description={`Browse AIP of ${e.name} and download airport approach charts`}
                  badges={(countryTypeAvailability[e.tld] ?? []).map(
                    (t) => typeBadge[t] ?? t,
                  )}
                  buttons={
                    e.isSingleLocale
                      ? [
                          {
                            title: `AIP ${e.name} in ${e.nativeLang}`,
                            hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                            href: `/${e.tld}/`,
                            variant: "primary" as const,
                          },
                        ]
                      : [
                          {
                            title: `AIP ${e.name} in English`,
                            hrefTitle: `AIP ${e.name} in English`,
                            href: `/${e.tld}/en/`,
                            variant: "primary" as const,
                          },
                          {
                            title: `AIP ${e.name} in ${e.nativeLang}`,
                            hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                            href: `/${e.tld}/`,
                            variant: "secondary" as const,
                          },
                        ]
                  }
                />
              ))}
            </div>
          </div>

          {/* About Box */}
          <AboutBox title="About this website" isH3={true}>
            This website aims to simplify the search for approach charts and
            Aeronautical Information Publication (AIP) for aerodromes, airports,
            and airfields in{" "}
            {countries.map((e, idx) => (
              <Fragment key={e.name}>
                <Link
                  className="text-drossblue hover:underline"
                  href={`/${e.tld}/`}
                  title={`Aeronautical Information Publication (AIP) of ${e.name}`}
                  target="_self"
                  rel="noopener"
                >
                  {e.name}
                </Link>
                {idx <= countries.length - 2
                  ? idx === countries.length - 2
                    ? " and "
                    : ", "
                  : ""}
              </Fragment>
            ))}
            . We are not liable for the correctness and accuracy of AIPs
            (Aeronautical Information Publication), as these are not operated by
            us. We merely provide convenient links to corresponding approach
            charts.
          </AboutBox>
        </main>

        <Footer />
        {/* Offline PWA: registers /sw.js after load (production hosts only). */}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
