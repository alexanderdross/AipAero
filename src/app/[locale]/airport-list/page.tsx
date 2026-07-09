import { LinkIcon } from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AboutCountryBox } from "~/components/about-country-box";
import { AirportMap, type MapMarker } from "~/components/airport-map";
import { LastUpdated } from "~/components/last-updated";
import { TradeAeroCta } from "~/components/trade-aero-cta";
import { Title } from "~/components/title";
import Link from "next/link";
import { getPathname, localeLangMapping, routing } from "~/i18n/routing";
import { type Airport } from "~/server/db/schema";
import LoadingList from "./loading-list";
import { QUERIES } from "~/server/db/queries";
import { i18nPathMapping, orgUrl, rootBreadcrumb } from "~/lib/utils";
import { SchemaProduct } from "~/components/schemas/schema-product";
import { modifiedDate as buildDate } from "~/lib/build-info";
import { SchemaSitenav } from "~/components/schemas/schema-sitenav";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";

// All slugs besides the static ones will be 404
export const dynamicParams = false;

// ISR safety net: a deploy seeds the incremental cache with the build's EMPTY
// prerender (the build has no DB). The post-deploy /api/revalidate call and
// the crawler POSTs refresh on demand; this hourly revalidate bounds staleness
// even if both are unavailable. The page stays static/prerendered.
export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AirportsPage" });
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  const pathname = getPathname({ href: "/airport-list", locale });
  const currentUrl = new URL(pathname, orgUrl).toString();

  const nativeLocale = locale.replace("-EN", "");
  const englishLocale = nativeLocale + "-EN";
  const locales = [...new Set([nativeLocale, englishLocale])];

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: currentUrl,
      languages:
        locale === "uk"
          ? undefined
          : Object.assign(
              {},
              ...locales.map((l) => ({
                [localeLangMapping[l]!]: new URL(
                  getPathname({ href: "/airport-list", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
    },
    openGraph: {
      ...previousOpenGraph,
      url: currentUrl,
      siteName: t("metaTitle"),
    },
    other: {
      ...(previousOther as Omit<
        Metadata["other"],
        keyof DeprecatedMetadataFields
      >),
      "twitter:url": currentUrl,
      abstract: t("metaDescription"),
      "og:image:alt": t("breadcrumb.name"),
    },
  };
}

export default async function IndexPage(
  props: Readonly<{
    params: Promise<{ locale: string }>;
  }>,
) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);
  const t = await getTranslations("AirportsPage");
  const crawledAt = await QUERIES.crawlUpdatedAt(locale.split("-")[0]!);

  const tCountry = await getTranslations("CountryPage");
  const currentUrl = new URL(
    getPathname({ href: "/airport-list", locale }),
    orgUrl,
  ).toString();
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
          "@id": currentUrl,
          name: t("breadcrumb.name"),
          alternateName: t("breadcrumb.alternateName"),
          description: t("breadcrumb.description"),
        },
      },
    ],
  };

  const modifiedDate = new Date(buildDate);

  return (
    <>
      <Title title={t("title")} description={t("description")} />
      <LastUpdated timestamp={crawledAt} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbsSchema),
        }}
      />
      <SchemaProduct
        name={t("breadcrumb.alternateName")}
        alternateName={t("breadcrumb.name")}
        description={t("breadcrumb.description")}
        publishedDate={modifiedDate}
        currentUrl={currentUrl}
      />
      <SchemaSitenav locale={locale} />
      <Suspense fallback={<LoadingList />}>
        <AirportLists locale={locale} />
      </Suspense>
      {/* Trade:Aero cross-sell (locale + country aware) */}
      <TradeAeroCta />
      {/* About AIP Box */}
      <AboutCountryBox isH3={false} />
    </>
  );
}

async function AirportLists({ locale }: { locale: string }) {
  const t = await getTranslations("AirportsPage");
  const tCommon = await getTranslations("Common");
  const country = locale.split("-")[0]!;

  const [
    vfrAirports,
    ifrAirports,
    heliports,
    militaryAirports,
    aeroportAirports,
    withCoords,
  ] = await Promise.all([
    QUERIES.vfrAirports(country),
    QUERIES.ifrAirports(country),
    QUERIES.heliports(country),
    QUERIES.aeroportAirports(country),
    QUERIES.militaryAirports(country),
    QUERIES.airportsWithCoords(country),
  ]);

  const i18nKeyMapping: Record<Airport["type"], string> = {
    vfr: "vfrCard",
    ifr: "ifrCard",
    heliport: "heliportCard",
    mil: "militaryCard",
    aeroport: "aeroportCard",
  };

  // Map markers: chart-linked fields that have coordinates. The detail-page href
  // mirrors the list links below (localized path + slug as a bare query key).
  const markers: MapMarker[] = withCoords
    .filter((a) => a.lat != null && a.lon != null)
    .map((a) => ({
      title: a.title,
      type: a.type,
      lat: a.lat!,
      lon: a.lon!,
      href:
        getPathname({ href: i18nPathMapping[a.type], locale }) + `?${a.slug}`,
    }));

  return (
    <>
      {markers.length > 0 && (
        <AirportMap
          markers={markers}
          locateLabel={tCommon("locate")}
          mapLabel={tCommon("map")}
        />
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-6">
          {[
            vfrAirports,
            ifrAirports,
            heliports,
            militaryAirports,
            aeroportAirports,
          ]
            .filter((x) => x.length > 0)
            .map((airports, index) => {
              // Safe: outer `.filter((x) => x.length > 0)` guarantees airports[0] exists.
              const airportType = airports[0]!.type;
              const key = i18nKeyMapping[airportType];
              return (
                <div
                  key={index}
                  className="min-w-80 flex-grow basis-0 border border-[#ccc] bg-white px-6 py-8"
                >
                  <h2 className="text-center text-2xl font-normal">
                    {t(`${key}.title`)}
                  </h2>
                  <p className="pb-2 text-center">{t(`${key}.description`)}</p>
                  <ol>
                    {airports.map((airport, index) => {
                      // Resolve the locale-prefixed detail URL server-side via
                      // getPathname (e.g. "/at/vfr") + the slug as a bare query
                      // key (".../vfr?LOWG"). We use next/link here rather than
                      // next-intl's <Link>, which is a client component and needs
                      // a NextIntlClientProvider ancestor (v4 behaviour) that this
                      // server-rendered list does not have - same pattern as box.tsx.
                      const href =
                        getPathname({
                          href: i18nPathMapping[airportType],
                          locale,
                        }) + `?${airport.slug}`;
                      return (
                        <li
                          key={index}
                          itemScope
                          itemType="https://schema.org/Airport"
                          className="flex items-center gap-x-4"
                        >
                          <span>{index + 1}.</span>
                          <Link
                            href={href}
                            itemProp="url"
                            className="justify-left text-drossblue flex gap-x-2 py-2 hover:underline"
                            title={t(`${key}.linkTitle`, {
                              airport: airport.title,
                            })}
                            aria-label={t(`${key}.linkTitle`, {
                              airport: airport.title,
                            })}
                            target="_blank"
                            rel="noopener"
                          >
                            <LinkIcon
                              className="h-5 w-5 flex-shrink-0"
                              aria-hidden="true"
                            />
                            <span itemProp="name">{airport.title}</span>
                          </Link>
                          <meta
                            itemProp="description"
                            content={t(`${key}.linkTitle`, {
                              airport: airport.title,
                            })}
                          />
                          {airport.icao && (
                            <meta itemProp="icaoCode" content={airport.icao} />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
