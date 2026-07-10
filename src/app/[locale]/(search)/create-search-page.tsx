import { ExternalLinkIcon } from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { modifiedDate as buildDate } from "~/lib/build-info";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { notFound } from "next/navigation";
import { AboutCountryBox } from "~/components/about-country-box";
import { AirportGadgets } from "~/components/airport-gadgets";
import { AirportGadgetsFallback } from "~/components/airport-gadgets-fallback";
import { Suspense } from "react";
import { ExternalLink } from "~/components/external-link";
import { SchemaProduct } from "~/components/schemas/schema-product";
import { SearchInputField } from "~/components/search-input-field";
import { Title } from "~/components/title";
import {
  getPathname,
  localeCountryMapping,
  localeLangMapping,
  routing,
  isSingleLocale,
} from "~/i18n/routing";
import { countryHasType, orgUrl, rootBreadcrumb } from "~/lib/utils";
import { QUERIES } from "~/server/db/queries";
import { type Airport } from "~/server/db/schema";

/**
 * The five airport-search routes (/vfr, /ifr, /heliports, /military,
 * /aeroports) are byte-identical except for four discriminators - this factory
 * is the single implementation, each route's page.tsx is a thin instantiation.
 * The `?ICAO` searchParams handling (detail pages addressed by a valueless
 * query key) is the documented SEO strategy and must stay exactly as is.
 */
export interface SearchPageConfig {
  /** DB enum value (`airports.type`), e.g. "vfr" / "heliport" / "mil". */
  type: Airport["type"];
  /** i18n namespace, e.g. "VfrPage". */
  namespace:
    | "VfrPage"
    | "IfrPage"
    | "HeliportPage"
    | "MilitaryPage"
    | "AeroportPage";
  /** Route pathname key from `routing.ts`, e.g. "/vfr". */
  href: "/vfr" | "/ifr" | "/heliports" | "/military" | "/aeroports";
  /** Prefix of the Product schema alternateName, e.g. "AIP VFR" -> "AIP VFR EDDF". */
  schemaPrefix: string;
}

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export function createSearchPage(config: SearchPageConfig) {
  const { type, namespace, href, schemaPrefix } = config;

  function generateStaticParams() {
    return routing.locales
      .filter((locale) => countryHasType(localeCountryMapping[locale]!, type))
      .map((locale) => ({ locale }));
  }

  async function generateMetadata(
    { params, searchParams }: PageProps,
    parent: ResolvingMetadata,
  ): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    const parentMetadata = await parent;
    const previousOpenGraph = parentMetadata.openGraph ?? {};
    const previousOther = parentMetadata.other ?? {};
    const pathname = getPathname({ href, locale });
    let currentUrl = new URL(pathname, orgUrl).toString();

    const nativeLocale = locale.replace("-EN", "");
    const englishLocale = nativeLocale + "-EN";
    const locales = [...new Set([nativeLocale, englishLocale])];

    let data: Airport | undefined;
    const country = localeCountryMapping[locale]!;
    const p = Object.keys(await searchParams);
    if (p.at(0) !== undefined) {
      data = await QUERIES.airport(p.at(0)!, country, type);
      if (!data) {
        return notFound();
      }
      currentUrl += `?${data.slug}`;
    }

    return {
      title: data
        ? `🛩️ ${t("resultTitle", { airport: data.title })}✔️`
        : t("metaTitle"),
      description: data
        ? `${t("resultDescription", { airport: data.title })}🗺️`
        : t("metaDescription"),
      alternates: {
        canonical: currentUrl,
        languages: isSingleLocale(locale)
          ? undefined
          : {
              ...Object.assign(
                {},
                ...locales.map((l) => ({
                  [localeLangMapping[l]!]:
                    new URL(
                      getPathname({ href, locale: l }),
                      orgUrl,
                    ).toString() + `${data ? `?${data.slug}` : ""}`,
                })),
              ),
              // Fallback for languages we do not target: the English version.
              "x-default":
                new URL(
                  getPathname({ href, locale: englishLocale }),
                  orgUrl,
                ).toString() + `${data ? `?${data.slug}` : ""}`,
            },
      },
      openGraph: {
        ...previousOpenGraph,
        url: currentUrl,
        siteName: data
          ? `🛩️ ${t("resultTitle", { airport: data.title })}✔️`
          : t("metaTitle"),
      },
      other: {
        ...(previousOther as Omit<
          Metadata["other"],
          keyof DeprecatedMetadataFields
        >),
        "twitter:url": currentUrl,
        abstract: data
          ? `${t("resultDescription", { airport: data.title })}🗺️`
          : t("metaDescription"),
        "og:image:alt": data
          ? t("resultTitle", { airport: data.title })
          : t("breadcrumb.name"),
      },
    };
  }

  async function SearchPage({ params, searchParams }: PageProps) {
    const { locale } = await params;
    // Enable static rendering
    setRequestLocale(locale);

    const p = Object.keys(await searchParams);
    const t = await getTranslations(namespace);

    let data: Airport | undefined;
    const country = localeCountryMapping[locale]!;
    if (p.at(0) !== undefined) {
      data = await QUERIES.airport(p.at(0)!, country, type);
      if (!data) {
        return notFound();
      }
    }

    const tCountry = await getTranslations("CountryPage");
    let currentUrl = new URL(getPathname({ href, locale }), orgUrl).toString();
    let schemaProductName = t("breadcrumb.alternateName");
    let schemaAlternateName = t("breadcrumb.name");
    let schemaDescription = t("breadcrumb.description");
    const breadcrumbsSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        rootBreadcrumb,
        {
          "@type": "ListItem",
          position: 2,
          item: {
            "@id":
              new URL(getPathname({ href: "/", locale }), orgUrl).toString() +
              "/",
            name: tCountry("breadcrumb.name"),
            alternateName: tCountry("breadcrumb.alternateName"),
            description: tCountry("breadcrumb.description"),
          },
        },
        {
          "@type": "ListItem",
          position: 3,
          item: {
            "@id": new URL(getPathname({ href, locale }), orgUrl).toString(),
            name: t("breadcrumb.name"),
            alternateName: t("breadcrumb.alternateName"),
            description: t("breadcrumb.description"),
          },
        },
      ],
    };
    if (data) {
      currentUrl = new URL(
        getPathname({
          href: { pathname: href, query: { [data.slug]: "" } },
          locale,
        }),
        orgUrl,
      )
        .toString()
        .replace("=", "");
      schemaProductName = t("resultTitle", { airport: data.title });
      schemaAlternateName = data.icao
        ? `${schemaPrefix} ${data.icao}`
        : data.title;
      schemaDescription = t("resultDescription", { airport: data.title });
      breadcrumbsSchema.itemListElement.push({
        "@type": "ListItem",
        position: 4,
        item: {
          "@id": currentUrl,
          name: data.icao ?? data.title,
          alternateName: t("resultTitle", { airport: data.title }),
          description: t("resultDescription", { airport: data.title }),
        },
      });
    }

    const modifiedDate = new Date(buildDate);

    return (
      <>
        <Title
          title={data ? t("resultTitle", { airport: data.title }) : t("title")}
          description={
            data
              ? t("resultDescription", { airport: data.title })
              : t("description")
          }
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbsSchema),
          }}
        />
        <SchemaProduct
          name={schemaProductName}
          alternateName={schemaAlternateName}
          description={schemaDescription}
          publishedDate={modifiedDate}
          currentUrl={currentUrl}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SearchInputField
            value={data?.icao ?? undefined}
            title={t("searchTitle")}
            type={type}
            country={country}
          />
          <div className="absolute left-1/2 mt-3 w-full max-w-7xl -translate-x-1/2 transform px-4 text-center text-white sm:px-6 lg:px-8">
            <ol>
              {data && (
                <li>
                  <ExternalLink
                    href={`${data.url}`}
                    className="bg-drossblue hover:bg-drossblue-light focus-visible:ring-drossblue flex w-full items-center justify-center gap-x-2 rounded-lg px-4 py-2.5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    hrefTitle={t("resultTitle", { airport: data.title })}
                  >
                    <span className="text-drossblue rounded bg-white px-1.5 py-0.5 text-xs font-semibold tracking-wide">
                      AIP
                    </span>
                    <span>{data.title}</span>
                    <ExternalLinkIcon
                      className="h-5 w-5 flex-shrink-0"
                      aria-hidden="true"
                    />
                  </ExternalLink>
                </li>
              )}
            </ol>
          </div>
        </div>

        {data && (
          <Suspense fallback={<AirportGadgetsFallback />}>
            <AirportGadgets
              airport={data}
              schemaName={data.title}
              schemaAlternateName={t("resultTitle", { airport: data.title })}
              schemaDescription={t("resultDescription", {
                airport: data.title,
              })}
              schemaUrl={currentUrl}
            />
          </Suspense>
        )}

        {/* About AIP Box */}
        <AboutCountryBox isH3={false} />
      </>
    );
  }

  return { generateStaticParams, generateMetadata, SearchPage };
}
