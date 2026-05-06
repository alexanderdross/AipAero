import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import getConfig from "next/config";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { AboutCountryBox } from "~/components/about-country-box";
import { Box } from "~/components/box";
import { SchemaProduct } from "~/components/schemas/schema-product";
import { SchemaSitenav } from "~/components/schemas/schema-sitenav";
import { Title } from "~/components/title";
import { getPathname, localeLangMapping, routing } from "~/i18n/routing";
import { cn, orgUrl, rootBreadcrumb } from "~/lib/utils";

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
      languages:
        locale === "uk"
          ? undefined
          : Object.assign(
              {},
              ...locales.map((l) => ({
                [localeLangMapping[l] as string]: new URL(
                  getPathname({ href: "/", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
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

  // Only Germany has IFR Card
  const keys = locale.startsWith("de")
    ? (["vfrCard", "ifrCard", "heliportCard"] as const)
    : locale.startsWith("fr")
      ? (["aeroportCard", "militaryCard"] as const)
      : (["vfrCard", "heliportCard"] as const);

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

  const { publicRuntimeConfig } = getConfig() as {
    publicRuntimeConfig: { modifiedDate: string };
  };
  const modifiedDate = new Date(publicRuntimeConfig.modifiedDate);

  return (
    <>
      <Title title={t("title")} description={t("description")} />
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "grid grid-cols-1 gap-6 md:grid-cols-2",
            keys.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2",
          )}
        >
          {keys.map((key) => (
            <Box
              key={key}
              title={t(`${key}.title`)}
              description={t(`${key}.description`)}
              buttons={[
                {
                  href: t(`${key}.buttonHref`),
                  hrefTitle: t(`${key}.buttonHrefTitle`),
                  title: t(`${key}.buttonTitle`),
                },
              ]}
            />
          ))}
        </div>
      </div>

      {/* About AIP Box */}
      <AboutCountryBox isH3={true} />
    </>
  );
}
