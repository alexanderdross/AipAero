import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AboutCountryBox } from "~/components/about-country-box";
import { AirportMap } from "~/components/airport-map";
import { LastUpdated } from "~/components/last-updated";
import { SaveCountryOfflineButton } from "~/components/save-country-offline-button";
import { TradeAeroCta } from "~/components/trade-aero-cta";
import { Title } from "~/components/title";
import Link from "next/link";
import {
  getPathname,
  isSingleLocale,
  localeLangMapping,
  routing,
} from "~/i18n/routing";
import { type Airport } from "~/server/db/schema";
import LoadingList from "./loading-list";
import { QUERIES } from "~/server/db/queries";
import { i18nPathMapping, orgUrl, rootBreadcrumb } from "~/lib/utils";
import { SchemaProduct } from "~/components/schemas/schema-product";
import { modifiedDate as buildDate } from "~/lib/build-info";
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
      languages: isSingleLocale(locale)
        ? undefined
        : {
            ...Object.assign(
              {},
              ...locales.map((l) => ({
                [localeLangMapping[l]!]: new URL(
                  getPathname({ href: "/airport-list", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
            // Fallback for languages we do not target: the English version.
            "x-default": new URL(
              getPathname({ href: "/airport-list", locale: englishLocale }),
              orgUrl,
            ).toString(),
          },
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
      <Suspense fallback={<LoadingList />}>
        <AirportLists locale={locale} />
      </Suspense>
      {/* About AIP Box */}
      <AboutCountryBox isH3={false} />
    </>
  );
}

async function AirportLists({ locale }: { locale: string }) {
  const t = await getTranslations("AirportsPage");
  const tCommon = await getTranslations("Common");
  const tWeather = await getTranslations("Weather");
  const country = locale.split("-")[0]!;

  // One cached read for the whole country, partitioned by type in JS (the
  // rows are title-ordered, so each partition stays sorted). The former five
  // per-type queries cost every regeneration five tag-cache checks, five D1
  // misses and five R2 writes - the multi-second streamed-content delay
  // Lighthouse caught on a freshly tag-busted list.
  const allAirports = await QUERIES.airportsByCountry(country);
  const byType = (type: Airport["type"]) =>
    allAirports.filter((a) => a.type === type);
  const vfrAirports = byType("vfr");
  const ifrAirports = byType("ifr");
  const heliports = byType("heliport");
  const militaryAirports = byType("mil");
  const aeroportAirports = byType("aeroport");

  const i18nKeyMapping: Record<Airport["type"], string> = {
    vfr: "vfrCard",
    ifr: "ifrCard",
    heliport: "heliportCard",
    mil: "militaryCard",
    aeroport: "aeroportCard",
  };

  // Country offline pack (PWA concept Phase 4): every detail page plus this
  // list page. The size hint mirrors the client component's per-page estimate
  // (~75 KB of stored inlineCss HTML per page).
  const pageCount = allAirports.length + 1;
  const sizeMb = Math.max(1, Math.round((pageCount * 75) / 1024));

  return (
    <>
      {/* Decorative map. Its markers are fetched client-side from
          /api/airport-coords (keyed by locale) so hundreds of coordinates never
          weigh down this heavy server render; it renders nothing when the
          country has no coordinates. */}
      <AirportMap
        locale={locale}
        locateLabel={tCommon("locate")}
        locateErrorLabel={tCommon("locateError")}
        mapLabel={tCommon("map")}
        fuelLabel={tWeather("fuel")}
        customsLabel={tCommon("customs")}
        pavedLabel={tCommon("pavedRunway")}
      />
      {/* Trade:Aero cross-sell (locale + country aware), placed between the
          map and the listings. */}
      <TradeAeroCta />
      {/* Explicit country bulk download (PWA Phase 4): HTML detail pages only,
          no PDFs. Hidden while the country has no airports (fresh deploy). */}
      {pageCount > 1 && (
        <SaveCountryOfflineButton
          locale={locale}
          downloadLabel={tCommon("bulkDownload", {
            count: pageCount,
            size: sizeMb,
          })}
          downloadedLabel={tCommon("bulkDownloaded")}
          updateLabel={tCommon("bulkUpdate")}
          removeLabel={tCommon("bulkRemove")}
          progressLabel={tCommon("bulkProgress")}
          cancelLabel={tCommon("bulkCancel")}
          errorLabel={tCommon("bulkError")}
          noSpaceLabel={tCommon("bulkNoSpace")}
        />
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ONE SVG symbol for the hundreds of per-row link icons below. An
            inline lucide LinkIcon per row cost ~350 bytes + 3 extra DOM nodes
            each - doubled by the RSC flight payload, ~0.5 MB / ~2,400 nodes on
            the 792-row DE list (document was 2.08 MB uncompressed, DOM 7,208
            elements). Each row references this symbol via <use> instead.
            Paths = lucide "link" (ISC licensed), keep in sync if the icon set
            ever changes. */}
        <svg className="hidden" aria-hidden="true">
          <symbol
            id="row-link-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </symbol>
        </svg>
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
                  className="border-drossgray-dark/15 min-w-80 flex-grow basis-0 rounded-xl border bg-white px-6 py-8 shadow-sm"
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
                      // The localized link title feeds the tooltip/title only.
                      // It used to also fill an aria-label and a microdata
                      // description meta per row - dropped 2026-07-12: the
                      // accessible name is better served by the visible link
                      // text (WCAG label-in-name), the boilerplate description
                      // added no schema value beyond name/url/icaoCode, and at
                      // ~200 bytes x2 (HTML + RSC payload) per row they were a
                      // measurable slice of the DE list's 2 MB document.
                      const linkTitle = t(`${key}.linkTitle`, {
                        airport: airport.title,
                      });
                      return (
                        <li
                          key={index}
                          itemScope
                          itemType="https://schema.org/Airport"
                          // content-visibility: below-fold rows skip layout +
                          // paint entirely (the DE list renders 792 of them;
                          // main-thread rendering was 1.6s). The intrinsic
                          // size matches a row's real height so the scrollbar
                          // stays stable; find-in-page still works.
                          className="flex items-center gap-x-4 [contain-intrinsic-size:auto_2.5rem] [content-visibility:auto]"
                        >
                          <span>{index + 1}.</span>
                          <Link
                            href={href}
                            itemProp="url"
                            className="justify-left text-drossblue flex gap-x-2 py-2 hover:underline"
                            title={linkTitle}
                            target="_blank"
                            rel="noopener"
                          >
                            <svg
                              className="h-5 w-5 flex-shrink-0"
                              aria-hidden="true"
                            >
                              <use href="#row-link-icon" />
                            </svg>
                            <span itemProp="name">{airport.title}</span>
                          </Link>
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
