import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  MoreVerticalIcon,
  ShareIcon,
  SquarePlusIcon,
  XIcon,
} from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { InstallAppButton } from "~/components/install-app-button";
import { SectionHeading } from "~/components/section-heading";
import { Title } from "~/components/title";
import {
  getPathname,
  isSingleLocale,
  localeLangMapping,
  routing,
} from "~/i18n/routing";
import { orgUrl } from "~/lib/utils";

// All slugs besides the static ones will be 404
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Guide sections, each an h2 + paragraph from the EfbPage namespace. The
// install section additionally renders the two platform step lines.
const SECTIONS = [
  "install",
  "offline",
  "bulk",
  "import",
  "tools",
  "weather",
  "customs",
  "disclaimer",
] as const;

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EfbPage" });
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  const pathname = getPathname({ href: "/efb", locale });
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
                  getPathname({ href: "/efb", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
            // Fallback for languages we do not target: the English version.
            "x-default": new URL(
              getPathname({ href: "/efb", locale: englishLocale }),
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

export default async function EfbPage(
  props: Readonly<{ params: Promise<{ locale: string }> }>,
) {
  const { locale } = await props.params;
  // Enable static rendering (MUST precede getTranslations - see CLAUDE.md).
  setRequestLocale(locale);
  const t = await getTranslations("EfbPage");
  const tMenu = await getTranslations("Menu");

  const airportListPath = getPathname({ href: "/airport-list", locale });
  const airportListHref = airportListPath.endsWith("/")
    ? airportListPath
    : airportListPath + "/";

  // Decorative tap-sequence mockups for the install steps (which icon to
  // tap where): pure inline SVG chips, aria-hidden - the adjacent text is
  // the accessible instruction.
  const installSteps = [
    { icons: [ShareIcon, SquarePlusIcon], text: t("installIos") },
    { icons: [MoreVerticalIcon, DownloadIcon], text: t("installAndroid") },
  ];
  const chip =
    "border-drossgray-dark/20 text-drossblue inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-white shadow-sm";

  // Install steps as schema.org/HowTo (rich-result candidate); the two
  // platforms are HowToSections of the same procedure. FAQ block as
  // FAQPage. This page is statically prerendered, so page-emitted JSON-LD
  // is safe (the duplication artifact only hits dynamically rendered
  // routes - see CLAUDE.md).
  const howToJson = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: t("installTitle"),
    description: t("installText"),
    step: [
      {
        "@type": "HowToSection",
        name: "iOS / iPadOS (Safari)",
        position: 1,
        itemListElement: [
          { "@type": "HowToStep", position: 1, text: t("installIos") },
        ],
      },
      {
        "@type": "HowToSection",
        name: "Android (Chrome)",
        position: 2,
        itemListElement: [
          { "@type": "HowToStep", position: 1, text: t("installAndroid") },
        ],
      },
    ],
  };
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ([1, 2, 3] as const).map((i) => ({
      "@type": "Question",
      name: t(`faq${i}q`),
      acceptedAnswer: { "@type": "Answer", text: t(`faq${i}a`) },
    })),
  };

  return (
    <>
      <Title title={t("title")} description={t("intro")} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJson) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }}
      />
      <div className="mx-auto mt-12 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="border-drossgray-dark/15 flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          {SECTIONS.map((section) => (
            <section key={section}>
              <SectionHeading className="text-xl font-semibold tracking-tight">
                {t(`${section}Title`)}
              </SectionHeading>
              {section === "bulk" ? (
                <p className="mt-3">
                  {t.rich("bulkText", {
                    list: (chunks) => (
                      <a
                        href={airportListHref}
                        title={tMenu("airports.hrefTitle")}
                        className="text-drossblue hover:underline"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
              ) : (
                <p className="mt-3">{t(`${section}Text`)}</p>
              )}
              {section === "install" && (
                <div className="mt-3 flex flex-col gap-3">
                  {installSteps.map(({ icons: [First, Second], text }) => (
                    <div
                      key={text}
                      className="border-drossgray-dark/15 bg-drossgray/50 flex items-center gap-3 rounded-lg border p-3"
                    >
                      <span
                        aria-hidden="true"
                        className="flex shrink-0 items-center gap-1"
                      >
                        <span className={chip}>
                          {First && <First className="size-4" />}
                        </span>
                        <ArrowRightIcon className="text-drossgray-dark size-3" />
                        <span className={chip}>
                          {Second && <Second className="size-4" />}
                        </span>
                      </span>
                      <span>{text}</span>
                    </div>
                  ))}
                  {/* Native install prompt where the browser offers one
                      (Chromium); renders nothing elsewhere - the manual
                      steps above stay the accessible path. */}
                  <InstallAppButton label={t("installButton")} />
                </div>
              )}
              {section === "offline" && (
                // Schematic save-button mockup: tap the download button,
                // get the saved state. Decorative - the text explains it.
                <span
                  aria-hidden="true"
                  className="border-drossgray-dark/15 bg-drossgray/50 mt-3 inline-flex items-center gap-1 rounded-lg border p-3"
                >
                  <span className={chip}>
                    <DownloadIcon className="size-4" />
                  </span>
                  <ArrowRightIcon className="text-drossgray-dark size-3" />
                  <span className={chip}>
                    <CheckIcon className="size-4" />
                  </span>
                </span>
              )}
              {section === "bulk" && (
                // Schematic pack-download mockup: progress bar + cancel.
                <span
                  aria-hidden="true"
                  className="border-drossgray-dark/15 bg-drossgray/50 mt-3 flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="bg-drossgray-dark/20 h-2 min-w-24 flex-1 overflow-hidden rounded-full">
                    <span className="bg-drossblue block h-full w-2/5 rounded-full" />
                  </span>
                  <span className={chip}>
                    <XIcon className="size-4" />
                  </span>
                </span>
              )}
            </section>
          ))}

          {/* FAQ - mirrored as FAQPage JSON-LD above. */}
          <section>
            <SectionHeading className="text-xl font-semibold tracking-tight">
              {t("faqTitle")}
            </SectionHeading>
            <div className="mt-3 flex flex-col gap-4">
              {([1, 2, 3] as const).map((i) => (
                <div key={i}>
                  <h3 className="font-semibold">{t(`faq${i}q`)}</h3>
                  <p className="mt-1">{t(`faq${i}a`)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Closing CTA: from the guide straight into the product. */}
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
          </section>
        </div>
      </div>

      {/* Bottom breadcrumb (root > country > EFB guide) + BreadcrumbList
          JSON-LD from the shared component. */}
      <BreadCrumbs locale={locale} page={{ href: "/efb" }} />
    </>
  );
}
