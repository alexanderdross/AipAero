import {
  ArrowRightIcon,
  DownloadIcon,
  MoreVerticalIcon,
  ShareIcon,
  SquarePlusIcon,
} from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { BreadCrumbs } from "~/components/breadcrumbs";
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

  return (
    <>
      <Title title={t("title")} description={t("intro")} />
      <div className="mx-auto mt-12 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="border-drossgray-dark/15 flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          {SECTIONS.map((section) => (
            <section key={section}>
              <h2 className="text-xl font-semibold tracking-tight">
                {t(`${section}Title`)}
              </h2>
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
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      {/* Bottom breadcrumb (root > country > EFB guide) + BreadcrumbList
          JSON-LD from the shared component. */}
      <BreadCrumbs locale={locale} page={{ href: "/efb" }} />
    </>
  );
}
