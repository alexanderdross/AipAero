import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { modifiedDate as buildDate } from "~/lib/build-info";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import {
  HelicopterIcon,
  ListIcon,
  PlaneIcon,
  PlaneTakeoffIcon,
  ShieldIcon,
  TowerControlIcon,
} from "lucide-react";
import { AboutCountryBox } from "~/components/about-country-box";
import { AirportSearchBox } from "~/components/airport-search-box";
import { Box } from "~/components/box";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { CountryFaq } from "~/components/country-faq";
import { FavoritesRecent } from "~/components/favorites-recent";
import { Hero } from "~/components/hero";
import { TradeAeroCta } from "~/components/trade-aero-cta";
import { SchemaProduct } from "~/components/schemas/schema-product";
import {
  getPathname,
  isSingleLocale,
  localeCountryMapping,
  localeLangMapping,
  routing,
} from "~/i18n/routing";
import { cn, orgUrl, serpTitle } from "~/lib/utils";

// Decorative icon per card type (keyed by the card message key). aria-hidden in
// Box, so it adds visual scent without changing the heading's accessible name.
const cardIcons: Record<string, React.ReactNode> = {
  vfrCard: <PlaneIcon className="size-6" />,
  ifrCard: <PlaneTakeoffIcon className="size-6" />,
  heliportCard: <HelicopterIcon className="size-6" />,
  aeroportCard: <TowerControlIcon className="size-6" />,
  militaryCard: <ShieldIcon className="size-6" />,
  airportListCard: <ListIcon className="size-6" />,
};

// Every valid locale is prerendered by generateStaticParams() below.
// dynamicParams = true lets a KNOWN locale self-heal via on-demand SSR when its
// OpenNext R2 incremental-cache entry is missing (post-deploy empty-cache
// window / eviction) instead of returning a hard NoFallbackError 404. Unknown
// locales are still rejected: the [locale] layout calls notFound() for any slug
// not in routing.locales, and unknown sub-paths 404 at the router.
export const dynamicParams = true;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function trailingSlash(url: string) {
  return url.endsWith("/") ? url : url + "/";
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata & DeprecatedMetadataFields> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CountryPage" });
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  const pathname = getPathname({ href: "/", locale });
  const currentUrl = new URL(pathname, orgUrl).toString();

  const nativeLocale = locale.replace("-EN", "");
  const englishLocale = nativeLocale + "-EN";
  const locales = [...new Set([nativeLocale, englishLocale])];

  return {
    title: serpTitle(t("metaTitle")),
    description: t("metaDescription"),
    alternates: {
      canonical: trailingSlash(currentUrl),
      languages: isSingleLocale(locale)
        ? undefined
        : {
            ...Object.assign(
              {},
              ...locales.map((l) => ({
                [localeLangMapping[l]!]: new URL(
                  getPathname({ href: "/", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
            // Fallback for languages we do not target: the English version.
            "x-default": new URL(
              getPathname({ href: "/", locale: englishLocale }),
              orgUrl,
            ).toString(),
          },
    },
    openGraph: {
      ...previousOpenGraph,
      url: trailingSlash(currentUrl),
      siteName: t("metaTitle"),
    },
    other: {
      ...(previousOther as Omit<
        Metadata["other"],
        keyof DeprecatedMetadataFields
      >),
      "twitter:url": trailingSlash(currentUrl),
      abstract: t("metaDescription"),
      "og:image:alt": t("breadcrumb.name"),
    },
  };
}

export default async function CountryPage(
  props: Readonly<{
    params: Promise<{ locale: string }>;
  }>,
) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);

  const t = await getTranslations("CountryPage");
  const tCommon = await getTranslations("Common");
  // Reuse the generic, already-localized "Search any airport by name or ICAO
  // code" placeholder (present in every locale for the 404 page) so the landing
  // search adds zero new i18n keys across the 94 message files.
  const tNotFound = await getTranslations("NotFound");

  // Cards are data-driven: show whichever type cards this locale's messages
  // define. Each country's CountryPage only carries the cards for the types it
  // exposes (see countryTypeAvailability), so t.has() gates them automatically.
  // airportListCard (the localized /airport-list link) exists in every locale.
  const allCardKeys = [
    "vfrCard",
    "ifrCard",
    "heliportCard",
    "aeroportCard",
    "militaryCard",
    "airportListCard",
  ] as const;
  const keys = allCardKeys.filter((k) => t.has(`${k}.title`));

  // Language-neutral anchor ids per card (deep-linkable, e.g. /de/#ifr) -
  // named after the routes they link to, stable across locales.
  const cardAnchor: Record<(typeof allCardKeys)[number], string> = {
    vfrCard: "vfr",
    ifrCard: "ifr",
    heliportCard: "heliports",
    aeroportCard: "aeroports",
    militaryCard: "military",
    airportListCard: "airport-list",
  };

  const currentUrl =
    new URL(getPathname({ href: "/", locale }), orgUrl).toString() + "/";

  const modifiedDate = new Date(buildDate);

  // BCP-47 language of the card copy (hyphens-auto + screen readers). Must be
  // the ISO code from localeLangMapping, NOT the URL locale prefix - "at",
  // "cz", "se" etc. are no languages (Lighthouse a11y: "[lang] attributes do
  // not have a valid value", seen live on /at/ 13.07.2026).
  const cardLang = localeLangMapping[locale]!;

  return (
    <>
      {/* The country landing search spans ALL of this country's types, so the
          visitor finds a field (and lands on its detail page) without first
          picking a category from the cards below. Locale-scoped: results stay
          in the current locale via `detailBase`. */}
      <Hero title={t("title")} description={t("description")}>
        <AirportSearchBox
          scope="country"
          country={localeCountryMapping[locale]!}
          detailBase={getPathname({ href: "/", locale })}
          placeholder={tNotFound("searchPlaceholder")}
          noResultsLabel={tCommon("noResults")}
          clearLabel={tCommon("clearSearch")}
        />
      </Hero>
      <SchemaProduct
        name={serpTitle(t("breadcrumb.alternateName"))}
        alternateName={t("breadcrumb.name")}
        description={t("breadcrumb.description")}
        publishedDate={modifiedDate}
        currentUrl={currentUrl}
      />
      {/* Trade:Aero cross-sell (locale + country aware) - placed directly under
          the search box, matching the search pages where the CTA sits right
          under the search (owner request). SSR text link, no image, so no
          LCP/CLS impact; the cards' top margin is trimmed to mt-6 so the CTA's
          own py-10 keeps the spacing balanced above and below. */}
      <TradeAeroCta />
      <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            keys.length >= 2 && "md:grid-cols-2",
            // 3 cards fill one row; 5 (BE) balance as 3+2. 4 stays a 2x2 grid.
            (keys.length === 3 || keys.length === 5) && "lg:grid-cols-3",
            // Keep 1-2 card layouts from stretching edge to edge.
            keys.length <= 2 && "mx-auto max-w-3xl",
          )}
        >
          {keys.map((key) => (
            <Box
              key={key}
              id={cardAnchor[key]}
              lang={cardLang}
              icon={cardIcons[key]}
              title={t(`${key}.title`)}
              description={t(`${key}.description`)}
              buttons={[
                {
                  href: t(`${key}.buttonHref`),
                  hrefTitle: t(`${key}.buttonHrefTitle`),
                  title: t(`${key}.buttonTitle`),
                  variant: "primary",
                },
              ]}
            />
          ))}
        </div>
      </div>

      {/* Personal favorites (offline-saved fields) + recently viewed, from
          localStorage. Client-only, placed ABOVE the about box (owner
          decision 13.07.2026): returning pilots - the only visitors this
          renders for - reach their fields without scrolling past the
          first-timer content. Still below the initial fold on virtually all
          viewports (hero + cards fill it), so the post-hydration appearance
          costs no field CLS; the SSR HTML stays byte-identical for crawlers
          and first-time visitors. Do NOT move it above the cards: there it
          WOULD sit in the initial viewport and shift SEO content. */}
      {/* Stable SSR anchor for the EFB guide's favorites deep link - the id
          must live on this always-present wrapper because the component
          renders nothing for first-time visitors. */}
      <div id="favorites" className="scroll-mt-24">
        <FavoritesRecent
          favoritesLabel={tCommon("favorites")}
          recentLabel={tCommon("recentlyViewed")}
          favoritesEmptyLabel={tCommon("favoritesEmpty")}
          recentEmptyLabel={tCommon("recentlyViewedEmpty")}
          // Gap from the cards above (matches the homepage + the CountryFaq
          // below, both mt-16). On the component's OWN div so the spacing only
          // applies once the card actually renders after hydration - the SSR
          // anchor stays flush, no dead gap. The CTA now sits ABOVE the cards,
          // so the old "no top margin" reasoning no longer applies here.
          className="mt-16"
        />
      </div>

      {/* Country-specific FAQ (visible text + FAQPage JSON-LD from the same
          strings) - targets the "aip <country>" / free-charts / chart-type
          query clusters from the Search Console data. Placed ABOVE the about
          box (owner decision 19.07.2026): the high-intent Q&A comes before the
          general "why this website" copy. */}
      <CountryFaq locale={locale} />

      {/* About AIP Box */}
      <AboutCountryBox isH3={true} />

      {/* Bottom breadcrumb: visible trail + BreadcrumbList JSON-LD from one
          data structure (root > country, the country is the current page). */}
      <BreadCrumbs locale={locale} />
    </>
  );
}
