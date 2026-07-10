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
import { SchemaSitenav } from "~/components/schemas/schema-sitenav";
import { SchemaWebsite } from "~/components/schemas/schema-website";
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

// All slugs besides the static ones will be 404
export const dynamicParams = false;

// Only available for Germany
export function generateStaticParams() {
  return routing.locales
    .filter((locale) =>
      countryHasType(localeCountryMapping[locale]!, "aeroport"),
    )
    .map((locale) => ({ locale }));
}

export async function generateMetadata(
  {
    params,
    searchParams,
  }: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AeroportPage" });
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  const pathname = getPathname({ href: "/aeroports", locale });
  let currentUrl = new URL(pathname, orgUrl).toString();

  const nativeLocale = locale.replace("-EN", "");
  const englishLocale = nativeLocale + "-EN";
  const locales = [...new Set([nativeLocale, englishLocale])];

  let data: Airport | undefined;
  const country = localeCountryMapping[locale]!;
  const p = Object.keys(await searchParams);
  if (p.at(0) !== undefined) {
    data = await QUERIES.airport(p.at(0)!, country, "aeroport");
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
        : Object.assign(
            {},
            ...locales.map((l) => ({
              [localeLangMapping[l]!]:
                new URL(
                  getPathname({ href: "/aeroports", locale: l }),
                  orgUrl,
                ).toString() + `${data ? `?${data.slug}` : ""}`,
            })),
          ),
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

export default async function IndexPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { locale } = await params;
  // Enable static rendering
  setRequestLocale(locale);

  const p = Object.keys(await searchParams);
  const t = await getTranslations("AeroportPage");

  let data: Airport | undefined;
  const country = localeCountryMapping[locale]!;
  if (p.at(0) !== undefined) {
    data = await QUERIES.airport(p.at(0)!, country, "aeroport");
    if (!data) {
      return notFound();
    }
  }

  const tCountry = await getTranslations("CountryPage");
  let currentUrl = new URL(
    getPathname({ href: "/aeroports", locale }),
    orgUrl,
  ).toString();
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
          "@id": new URL(
            getPathname({ href: "/aeroports", locale }),
            orgUrl,
          ).toString(),
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
        href: { pathname: "/aeroports", query: { [data.slug]: "" } },
        locale,
      }),
      orgUrl,
    )
      .toString()
      .replace("=", "");
    schemaProductName = t("resultTitle", { airport: data.title });
    schemaAlternateName = data.icao ? `AIP ${data.icao}` : data.title;
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
      <SchemaWebsite />
      <SchemaSitenav locale={locale} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SearchInputField
          value={data?.icao ?? undefined}
          title={t("searchTitle")}
          type="aeroport"
          country={country.toUpperCase()}
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
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-semibold tracking-wide">
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
            schemaDescription={t("resultDescription", { airport: data.title })}
            schemaUrl={currentUrl}
          />
        </Suspense>
      )}

      {/* About AIP Box */}
      <AboutCountryBox isH3={false} />
    </>
  );
}
