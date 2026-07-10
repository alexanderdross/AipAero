import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { modifiedDate as buildDate } from "~/lib/build-info";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import {
  HelicopterIcon,
  PlaneIcon,
  PlaneTakeoffIcon,
  ShieldIcon,
  TowerControlIcon,
} from "lucide-react";
import { AboutCountryBox } from "~/components/about-country-box";
import { Box } from "~/components/box";
import { Hero } from "~/components/hero";
import { TradeAeroCta } from "~/components/trade-aero-cta";
import { SchemaProduct } from "~/components/schemas/schema-product";
import {
  getPathname,
  isSingleLocale,
  localeLangMapping,
  routing,
} from "~/i18n/routing";
import { cn, orgUrl, rootBreadcrumb } from "~/lib/utils";

// Decorative icon per card type (keyed by the card message key). aria-hidden in
// Box, so it adds visual scent without changing the heading's accessible name.
const cardIcons: Record<string, React.ReactNode> = {
  vfrCard: <PlaneIcon className="size-6" />,
  ifrCard: <PlaneTakeoffIcon className="size-6" />,
  heliportCard: <HelicopterIcon className="size-6" />,
  aeroportCard: <TowerControlIcon className="size-6" />,
  militaryCard: <ShieldIcon className="size-6" />,
};

// All slugs besides the static ones will be 404
export const dynamicParams = false;

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
    title: t("metaTitle"),
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

  // Cards are data-driven: show whichever type cards this locale's messages
  // define. Each country's CountryPage only carries the cards for the types it
  // exposes (see countryTypeAvailability), so t.has() gates them automatically.
  const allCardKeys = [
    "vfrCard",
    "ifrCard",
    "heliportCard",
    "aeroportCard",
    "militaryCard",
  ] as const;
  const keys = allCardKeys.filter((k) => t.has(`${k}.title`));

  const currentUrl =
    new URL(getPathname({ href: "/", locale }), orgUrl).toString() + "/";
  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      rootBreadcrumb,
      {
        "@type": "ListItem",
        position: 2,
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

  const cardLang = locale.replace("-EN", "");

  return (
    <>
      <Hero title={t("title")} description={t("description")} />
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
      <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            keys.length >= 2 && "md:grid-cols-2",
            keys.length === 3 && "lg:grid-cols-3",
            // Keep 1-2 card layouts from stretching edge to edge.
            keys.length <= 2 && "mx-auto max-w-3xl",
          )}
        >
          {keys.map((key) => (
            <Box
              key={key}
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

      {/* Trade:Aero cross-sell (locale + country aware) */}
      <TradeAeroCta />

      {/* About AIP Box */}
      <AboutCountryBox isH3={true} />
    </>
  );
}
