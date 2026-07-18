import { ArrowRightIcon } from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { HashDetailsOpener } from "~/components/hash-details-opener";
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

// The three guides, each a how-to with N ordered steps. Keys map to the
// GuidesPage.guides.<key> i18n sub-namespace ({title, intro, s1..sN}).
const GUIDES = [
  { key: "charts", steps: ["s1", "s2", "s3", "s4"] },
  { key: "airac", steps: ["s1", "s2", "s3"] },
  { key: "metar", steps: ["s1", "s2", "s3"] },
] as const;

const FAQ = [1, 2, 3] as const;

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "GuidesPage" });
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  const pathname = getPathname({ href: "/guides", locale });
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
                  getPathname({ href: "/guides", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
            // Fallback for languages we do not target: the English version.
            "x-default": new URL(
              getPathname({ href: "/guides", locale: englishLocale }),
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

export default async function GuidesPage(
  props: Readonly<{ params: Promise<{ locale: string }> }>,
) {
  const { locale } = await props.params;
  // Enable static rendering (MUST precede getTranslations - see CLAUDE.md).
  setRequestLocale(locale);
  const t = await getTranslations("GuidesPage");
  const tMenu = await getTranslations("Menu");
  const tFooter = await getTranslations("Footer");

  const airportListPath = getPathname({ href: "/airport-list", locale });
  const airportListHref = airportListPath.endsWith("/")
    ? airportListPath
    : airportListPath + "/";

  // Content-hub cross-link to the sibling aviation glossary page (reuses the
  // Footer namespace's localized label - no new i18n string).
  const glossaryPath = getPathname({ href: "/glossary", locale });
  const glossaryHref = glossaryPath.endsWith("/")
    ? glossaryPath
    : glossaryPath + "/";

  const guidesPath = getPathname({ href: "/guides", locale });
  const currentUrl = new URL(
    guidesPath.endsWith("/") ? guidesPath : guidesPath + "/",
    orgUrl,
  ).toString();

  // One schema.org/HowTo per guide, each step a positioned HowToStep whose url
  // is the guide's on-page anchor (its SectionHeading slug). Statically
  // prerendered page, so page-emitted JSON-LD is safe (the Workers duplication
  // artifact only hits dynamically rendered routes - see CLAUDE.md).
  const howToJson = GUIDES.map((g) => {
    const anchor = `${currentUrl}#${slugify(t(`guides.${g.key}.title`))}`;
    return {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "@id": anchor,
      url: anchor,
      name: t(`guides.${g.key}.title`),
      description: t(`guides.${g.key}.intro`),
      step: g.steps.map((s, idx) => ({
        "@type": "HowToStep",
        position: idx + 1,
        url: anchor,
        text: t(`guides.${g.key}.${s}`),
      })),
    };
  });
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${currentUrl}#${slugify(t("faqTitle"))}`,
    url: currentUrl,
    mainEntity: FAQ.map((i) => {
      const anchor = `${currentUrl}#${slugify(t(`faq.q${i}`))}`;
      return {
        "@type": "Question",
        "@id": anchor,
        url: anchor,
        name: t(`faq.q${i}`),
        acceptedAnswer: { "@type": "Answer", text: t(`faq.a${i}`) },
      };
    }),
  };

  return (
    <>
      <Title title={t("title")} description={t("intro")} />
      {howToJson.map((json) => (
        <script
          key={json["@id"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }}
      />
      <div className="mx-auto mt-12 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="border-drossgray-dark/15 flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          {GUIDES.map((g) => (
            <section key={g.key} className="scroll-mt-24">
              <SectionHeading
                className="text-xl font-semibold tracking-tight"
                linkTitle={`${t("title")} - ${t(`guides.${g.key}.title`)}`}
              >
                {t(`guides.${g.key}.title`)}
              </SectionHeading>
              <p className="mt-3">{t(`guides.${g.key}.intro`)}</p>
              {/* Steps are always-visible ordered content (crawlable, HowTo). */}
              <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
                {g.steps.map((s) => (
                  <li key={s}>{t(`guides.${g.key}.${s}`)}</li>
                ))}
              </ol>
            </section>
          ))}

          {/* FAQ - project accordion convention (CLAUDE.md): native details
              with hash ids matching the FAQPage JSON-LD @id/url above; the
              HashDetailsOpener island binds hash <-> accordion two-way. */}
          <section className="border-drossgray-dark/15 border-t pt-6">
            <HashDetailsOpener />
            <SectionHeading
              className="text-xl font-semibold tracking-tight"
              linkTitle={`${t("title")} - ${t("faqTitle")}`}
            >
              {t("faqTitle")}
            </SectionHeading>
            <div className="divide-drossgray-dark/10 mt-2 divide-y">
              {FAQ.map((i) => (
                <details
                  key={i}
                  id={slugify(t(`faq.q${i}`))}
                  className="group scroll-mt-24 py-1"
                >
                  <summary
                    title={t(`faq.q${i}`)}
                    className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-x-2 py-2 [&::-webkit-details-marker]:hidden"
                  >
                    <h3 className="font-semibold">{t(`faq.q${i}`)}</h3>
                    <span
                      aria-hidden="true"
                      className="text-drossgray-dark shrink-0 transition-transform group-open:rotate-90"
                    >
                      ›
                    </span>
                  </summary>
                  <p className="pb-3">{t(`faq.a${i}`)}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Closing CTA: from the guides straight into the product, plus a
              discreet cross-link to the sibling aviation glossary (content
              hub). */}
          <section className="border-drossgray-dark/15 border-t pt-6 text-center">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("ctaTitle")}
            </h2>
            <a
              href={airportListHref}
              title={tMenu("airports.hrefTitle")}
              className="bg-drossblue hover:bg-drossblue-light mt-4 inline-flex min-h-10 items-center gap-x-2 rounded-lg px-5 py-2.5 font-medium text-white transition-colors"
            >
              <span>{tMenu("airports.title")}</span>
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </a>
            <p className="text-drossgray-dark mt-4 text-sm">
              <a
                href={glossaryHref}
                title={tFooter("glossary.hrefTitle")}
                className="text-drossblue underline"
              >
                {tFooter("glossary.title")}
              </a>
            </p>
          </section>
        </div>
      </div>

      {/* Bottom breadcrumb (root > country > Guides) + BreadcrumbList JSON-LD. */}
      <BreadCrumbs locale={locale} page={{ href: "/guides" }} />
    </>
  );
}
