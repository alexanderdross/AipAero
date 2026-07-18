import { ArrowRightIcon } from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { SectionHeading, slugify } from "~/components/section-heading";
import { Title } from "~/components/title";
import {
  getPathname,
  isSingleLocale,
  localeLangMapping,
  routing,
} from "~/i18n/routing";
import { orgUrl, serpTitle } from "~/lib/utils";

// All slugs besides the static ones will be 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// The glossary terms, in reading order. Each has a `terms.<key>.name` and
// `terms.<key>.def` in the GlossaryPage namespace. Order groups the AIP/edition
// concepts, the flight rules, the weather reports, then the codes/charts.
const TERMS = [
  "aip",
  "eaip",
  "airac",
  "vfr",
  "ifr",
  "metar",
  "taf",
  "icao",
  "charts",
] as const;

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "GlossaryPage" });
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  const pathname = getPathname({ href: "/glossary", locale });
  const currentUrl = new URL(pathname, orgUrl).toString();

  const nativeLocale = locale.replace("-EN", "");
  const englishLocale = nativeLocale + "-EN";
  const locales = [...new Set([nativeLocale, englishLocale])];

  return {
    title: serpTitle(t("metaTitle")),
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
                  getPathname({ href: "/glossary", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
            // Fallback for languages we do not target: the English version.
            "x-default": new URL(
              getPathname({ href: "/glossary", locale: englishLocale }),
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
      "og:image:alt": t("title"),
    },
  };
}

export default async function GlossaryPage(
  props: Readonly<{ params: Promise<{ locale: string }> }>,
) {
  const { locale } = await props.params;
  // Enable static rendering (MUST precede getTranslations - see CLAUDE.md).
  setRequestLocale(locale);
  const t = await getTranslations("GlossaryPage");
  const tMenu = await getTranslations("Menu");
  const tFooter = await getTranslations("Footer");

  const airportListPath = getPathname({ href: "/airport-list", locale });
  const airportListHref = airportListPath.endsWith("/")
    ? airportListPath
    : airportListPath + "/";

  // Content-hub cross-link to the sibling pilot guides page (reuses the Footer
  // namespace's localized label - no new i18n string).
  const guidesPath = getPathname({ href: "/guides", locale });
  const guidesHref = guidesPath.endsWith("/") ? guidesPath : guidesPath + "/";

  const glossaryPath = getPathname({ href: "/glossary", locale });
  const currentUrl = new URL(
    glossaryPath.endsWith("/") ? glossaryPath : glossaryPath + "/",
    orgUrl,
  ).toString();

  // schema.org/DefinedTermSet: each term is a DefinedTerm whose @id/url is its
  // on-page anchor (the SectionHeading slug), so the definitions are directly
  // citable jump targets. This page is statically prerendered, so page-emitted
  // JSON-LD is safe (the Workers duplication artifact only hits dynamically
  // rendered routes - see CLAUDE.md).
  const termAnchor = (key: (typeof TERMS)[number]) =>
    `${currentUrl}#${slugify(t(`terms.${key}.name`))}`;
  const definedTermSet = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${currentUrl}#glossary`,
    url: currentUrl,
    name: t("title"),
    description: t("intro"),
    hasDefinedTerm: TERMS.map((key) => ({
      "@type": "DefinedTerm",
      "@id": termAnchor(key),
      url: termAnchor(key),
      name: t(`terms.${key}.name`),
      description: t(`terms.${key}.def`),
      inDefinedTermSet: `${currentUrl}#glossary`,
    })),
  };

  return (
    <>
      <Title title={t("title")} description={t("intro")} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSet) }}
      />
      <div className="mx-auto mt-12 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        {/* A real definition list: semantic <dl>, crawlable and citable, no
            accordions (the definitions are short and should always be visible
            for both readers and LLMs). Each term self-anchors via
            SectionHeading. */}
        <dl className="border-drossgray-dark/15 flex flex-col gap-6 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          {TERMS.map((key) => (
            <div key={key} className="scroll-mt-24">
              <dt>
                <SectionHeading
                  className="text-xl font-semibold tracking-tight"
                  linkTitle={`${t("title")} - ${t(`terms.${key}.name`)}`}
                >
                  {t(`terms.${key}.name`)}
                </SectionHeading>
              </dt>
              <dd className="mt-2">{t(`terms.${key}.def`)}</dd>
            </div>
          ))}

          {/* Closing CTA: from the glossary straight into the product, plus a
              discreet cross-link to the sibling pilot guides (content hub). */}
          <div className="border-drossgray-dark/15 border-t pt-6 text-center">
            <a
              href={airportListHref}
              title={tMenu("airports.hrefTitle")}
              className="bg-drossblue hover:bg-drossblue-light inline-flex min-h-10 items-center gap-x-2 rounded-lg px-5 py-2.5 font-medium text-white transition-colors"
            >
              <span>{tMenu("airports.title")}</span>
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </a>
            <p className="text-drossgray-dark mt-4 text-sm">
              <a
                href={guidesHref}
                title={tFooter("guides.hrefTitle")}
                className="text-drossblue underline"
              >
                {tFooter("guides.title")}
              </a>
            </p>
          </div>
        </dl>
      </div>

      {/* Bottom breadcrumb (root > country > Glossary) + BreadcrumbList
          JSON-LD from the shared component. */}
      <BreadCrumbs locale={locale} page={{ href: "/glossary" }} />
    </>
  );
}
