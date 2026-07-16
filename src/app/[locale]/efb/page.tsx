import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  MonitorDownIcon,
  MoreVerticalIcon,
  ShareIcon,
  SquarePlusIcon,
  XIcon,
} from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { HashDetailsOpener } from "~/components/hash-details-opener";
import { InstallAppButton } from "~/components/install-app-button";
import { SectionHeading, slugify } from "~/components/section-heading";
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
  "favorites",
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
  const tCommon = await getTranslations("Common");
  // The API/data-cooperation note links the site's existing contact (imprint
  // network) - single source of truth for the address, no new one invented.
  const tFooter = await getTranslations("Footer");

  const airportListPath = getPathname({ href: "/airport-list", locale });
  const airportListHref = airportListPath.endsWith("/")
    ? airportListPath
    : airportListPath + "/";
  // Deep link to the favorites/recently-viewed section at the bottom of the
  // country landing page (stable SSR anchor id, see [locale]/page.tsx).
  const countryPath = getPathname({ href: "/", locale });
  const favoritesHref =
    (countryPath.endsWith("/") ? countryPath : countryPath + "/") +
    "#favorites";
  // Permanent underline: inline links inside body copy must be recognizable
  // without color (axe link-in-text-block + owner feedback).
  const inlineLink = "text-drossblue underline";

  // Decorative tap-sequence mockups for the install steps (which icon to
  // tap where): pure inline SVG chips, aria-hidden - the adjacent text is
  // the accessible instruction.
  const installSteps = [
    { icons: [ShareIcon, SquarePlusIcon], text: t("installIos") },
    { icons: [MoreVerticalIcon, DownloadIcon], text: t("installAndroid") },
    { icons: [MonitorDownIcon, DownloadIcon], text: t("installDesktop") },
  ];
  const chip =
    "border-drossgray-dark/20 text-drossblue inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-white shadow-sm";

  // The WHOLE guide as one schema.org/HowTo (owner request 13.07.2026):
  // every chapter is a positioned HowToStep whose url is its section anchor
  // (SectionHeading slug), so the steps are directly citable jump targets;
  // the install chapter is a HowToSection grouping the three platform steps.
  // Text comes from the SAME strings as the visible copy (inline-link tags
  // stripped via t.markup - never markup-only). This page is statically
  // prerendered, so page-emitted JSON-LD is safe (the duplication artifact
  // only hits dynamically rendered routes - see CLAUDE.md).
  const efbPath = getPathname({ href: "/efb", locale });
  const currentUrl = new URL(
    efbPath.endsWith("/") ? efbPath : efbPath + "/",
    orgUrl,
  ).toString();
  const stripTags = {
    list: (chunks: string) => chunks,
    country: (chunks: string) => chunks,
  };
  const sectionAnchor = (section: (typeof SECTIONS)[number]) =>
    `${currentUrl}#${slugify(t(`${section}Title`))}`;
  const howToJson = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${currentUrl}#howto`,
    url: currentUrl,
    name: t("title"),
    description: t("intro"),
    step: SECTIONS.map((section, idx) =>
      section === "install"
        ? {
            "@type": "HowToSection",
            "@id": sectionAnchor(section),
            url: sectionAnchor(section),
            position: idx + 1,
            name: t("installTitle"),
            // The platform steps share their section's anchor - they have no
            // own DOM ids, and the section is where all three are visible.
            itemListElement: [
              {
                "@type": "HowToStep",
                position: 1,
                url: sectionAnchor(section),
                text: t("installIos"),
              },
              {
                "@type": "HowToStep",
                position: 2,
                url: sectionAnchor(section),
                text: t("installAndroid"),
              },
              {
                "@type": "HowToStep",
                position: 3,
                url: sectionAnchor(section),
                text: t("installDesktop"),
              },
            ],
          }
        : {
            "@type": "HowToStep",
            "@id": sectionAnchor(section),
            url: sectionAnchor(section),
            position: idx + 1,
            name: t(`${section}Title`),
            text: t.markup(`${section}Text`, stripTags),
          },
    ),
  };
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${currentUrl}#${slugify(t("faqTitle"))}`,
    url: currentUrl,
    mainEntity: ([1, 2, 3] as const).map((i) => {
      // @id/url per question = its accordion hash anchor (owner request:
      // every schema node cites its real DOM anchor).
      const anchor = `${currentUrl}#${slugify(t(`faq${i}q`))}`;
      return {
        "@type": "Question",
        "@id": anchor,
        url: anchor,
        name: t(`faq${i}q`),
        acceptedAnswer: {
          "@type": "Answer",
          // Strip the inline-link tag (faq2a's <home>) - JSON-LD carries
          // text.
          text: t.markup(`faq${i}a`, { home: (chunks) => chunks }),
        },
      };
    }),
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
              <SectionHeading
                className="text-xl font-semibold tracking-tight"
                linkTitle={`${t("title")} - ${t(`${section}Title`)}`}
              >
                {t(`${section}Title`)}
              </SectionHeading>
              {section === "bulk" || section === "favorites" ? (
                // Sections whose copy carries an inline deep link: the bulk
                // download lives on the airport-list page, the favorites /
                // recently-viewed lists at the bottom of the country page.
                <p className="mt-3">
                  {t.rich(`${section}Text`, {
                    list: (chunks) => (
                      <a
                        href={airportListHref}
                        title={tMenu("airports.hrefTitle")}
                        className={inlineLink}
                      >
                        {chunks}
                      </a>
                    ),
                    country: (chunks) => (
                      <a
                        href={favoritesHref}
                        title={tCommon("favorites")}
                        className={inlineLink}
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

          {/* FAQ - project accordion convention (CLAUDE.md): native details
              with hash ids matching the FAQPage JSON-LD @id/url above; the
              HashDetailsOpener island binds hash <-> accordion two-way. */}
          <section>
            <HashDetailsOpener />
            <SectionHeading
              className="text-xl font-semibold tracking-tight"
              linkTitle={`${t("title")} - ${t("faqTitle")}`}
            >
              {t("faqTitle")}
            </SectionHeading>
            <div className="divide-drossgray-dark/10 mt-2 divide-y">
              {([1, 2, 3] as const).map((i) => (
                <details
                  key={i}
                  id={slugify(t(`faq${i}q`))}
                  className="group scroll-mt-24 py-1"
                >
                  <summary
                    title={t(`faq${i}q`)}
                    className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-x-2 py-2 [&::-webkit-details-marker]:hidden"
                  >
                    <h3 className="font-semibold">{t(`faq${i}q`)}</h3>
                    <span
                      aria-hidden="true"
                      className="text-drossgray-dark shrink-0 transition-transform group-open:rotate-90"
                    >
                      ›
                    </span>
                  </summary>
                  <p className="pb-3">
                    {t.rich(`faq${i}a`, {
                      // faq2a's country list lives on the GLOBAL homepage.
                      home: (chunks) => (
                        <Link
                          href="/"
                          title={tCommon("homeLink")}
                          className={inlineLink}
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* B2B: structured-data / API cooperation offer. Standalone (NOT a
              HowToStep - it is a partnership note, not a pilot instruction), so
              it is left out of the HowTo JSON-LD above. Links the site's
              existing contact (Footer namespace). */}
          <section className="border-drossgray-dark/15 border-t pt-6">
            <SectionHeading
              className="text-xl font-semibold tracking-tight"
              linkTitle={`${t("title")} - ${t("apiTitle")}`}
            >
              {t("apiTitle")}
            </SectionHeading>
            <p className="mt-3">
              {t.rich("apiText", {
                contact: (chunks) => (
                  <a
                    href={tFooter("contact.href")}
                    title={tFooter("contact.hrefTitle")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={inlineLink}
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
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
