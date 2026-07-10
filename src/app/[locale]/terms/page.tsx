import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
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

// The sources are language-independent data, so they live in code (only the
// section headings / descriptors are translated). The addresses are rendered
// as PLAIN TEXT on purpose - deliberately not clickable.
const AIP_SOURCES: { name: string; url: string }[] = [
  { name: "Austro Control (Österreich)", url: "https://eaip.austrocontrol.at" },
  { name: "skeyes (Belgium & Luxembourg)", url: "https://ops.skeyes.be" },
  { name: "ANS CR (Česko)", url: "https://aim.rlp.cz" },
  { name: "Naviair (Danmark)", url: "https://aim.naviair.dk" },
  {
    name: "DFS Deutsche Flugsicherung (Deutschland)",
    url: "https://aip.dfs.de",
  },
  {
    name: "SIA - Service de l'Information Aéronautique (France)",
    url: "https://www.sia.aviation-civile.gouv.fr",
  },
  { name: "HASP (Ελλάδα)", url: "https://aisgr.hasp.gov.gr" },
  { name: "LVNL (Nederland)", url: "https://eaip.lvnl.nl" },
  { name: "Avinor (Norge)", url: "https://aim-prod.avinor.no" },
  { name: "PANSA (Polska)", url: "https://www.ais.pansa.pl" },
  { name: "LFV (Sverige)", url: "https://aro.lfv.se" },
  { name: "NATS (United Kingdom)", url: "https://nats-uk.ead-it.com" },
];

// Descriptor for each embedded source comes from i18n (srcAwc etc.).
const DATA_SOURCES: { name: string; url: string; descKey: string }[] = [
  {
    name: "NOAA / Aviation Weather Center",
    url: "https://aviationweather.gov",
    descKey: "srcAwc",
  },
  {
    name: "OurAirports",
    url: "https://ourairports.com",
    descKey: "srcOurAirports",
  },
  { name: "OpenAIP", url: "https://www.openaip.net", descKey: "srcOpenAip" },
  {
    name: "OpenStreetMap / Nominatim",
    url: "https://www.openstreetmap.org",
    descKey: "srcOsm",
  },
];

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TermsPage" });
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  const pathname = getPathname({ href: "/terms", locale });
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
                  getPathname({ href: "/terms", locale: l }),
                  orgUrl,
                ).toString(),
              })),
            ),
            // Fallback for languages we do not target: the English version.
            "x-default": new URL(
              getPathname({ href: "/terms", locale: englishLocale }),
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

export default async function TermsPage(
  props: Readonly<{ params: Promise<{ locale: string }> }>,
) {
  const { locale } = await props.params;
  // Enable static rendering (MUST precede getTranslations - see CLAUDE.md).
  setRequestLocale(locale);
  const t = await getTranslations("TermsPage");

  return (
    <>
      <Title title={t("title")} description={t("intro")} />
      <div className="mx-auto mt-12 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="border-drossgray-dark/15 flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          <section>
            <h2 className="text-xl font-semibold tracking-tight">
              {t("servicesTitle")}
            </h2>
            <p className="mt-3">{t("servicesText")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">
              {t("disclaimerTitle")}
            </h2>
            <p className="mt-3">{t("disclaimerText")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">
              {t("sourcesTitle")}
            </h2>
            <p className="mt-3">{t("sourcesIntro")}</p>

            <h3 className="mt-5 font-medium">{t("sourcesAip")}</h3>
            <ul className="mt-2 flex flex-col gap-y-1 text-sm">
              {AIP_SOURCES.map((s) => (
                <li key={s.url}>
                  {s.name}
                  {" - "}
                  {/* Plain text on purpose: not a hyperlink. */}
                  <span className="text-drossgray-dark break-all">{s.url}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 font-medium">{t("sourcesData")}</h3>
            <ul className="mt-2 flex flex-col gap-y-1 text-sm">
              {DATA_SOURCES.map((s) => (
                <li key={s.url}>
                  {s.name} ({t(s.descKey)}){" - "}
                  {/* Plain text on purpose: not a hyperlink. */}
                  <span className="text-drossgray-dark break-all">{s.url}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
