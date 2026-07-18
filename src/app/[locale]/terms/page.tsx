import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { SectionHeading } from "~/components/section-heading";
import { Title } from "~/components/title";
import {
  getPathname,
  isSingleLocale,
  localeLangMapping,
  routing,
} from "~/i18n/routing";
import { orgUrl, serpTitle } from "~/lib/utils";

// All slugs besides the static ones will be 404
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// The sources are language-independent data, so they live in code (only the
// section headings / descriptors are translated). The addresses are rendered
// as PLAIN TEXT on purpose - deliberately not clickable.
// KEEP THIS IN SYNC WITH `liveCountries` (src/lib/utils.ts): every launched
// country's official AIP provider must be listed here (attribution). The order
// follows the onboarding order.
// `cc` = the liveCountries code (src/lib/utils.ts). It makes this list
// machine-checkable: scripts/check-live-countries-coverage.mjs asserts every
// live country's AIP provider is attributed here (BE covers BE+LU, one row).
const AIP_SOURCES: { cc: string; name: string; url: string }[] = [
  {
    cc: "at",
    name: "Austro Control (Österreich)",
    url: "https://eaip.austrocontrol.at",
  },
  {
    cc: "be",
    name: "skeyes (Belgium & Luxembourg)",
    url: "https://ops.skeyes.be",
  },
  { cc: "cz", name: "ANS CR (Česko)", url: "https://aim.rlp.cz" },
  { cc: "dk", name: "Naviair (Danmark)", url: "https://aim.naviair.dk" },
  {
    cc: "de",
    name: "DFS Deutsche Flugsicherung (Deutschland)",
    url: "https://aip.dfs.de",
  },
  {
    cc: "fr",
    name: "SIA - Service de l'Information Aéronautique (France)",
    url: "https://www.sia.aviation-civile.gouv.fr",
  },
  { cc: "gr", name: "HASP (Ελλάδα)", url: "https://aisgr.hasp.gov.gr" },
  { cc: "nl", name: "LVNL (Nederland)", url: "https://eaip.lvnl.nl" },
  { cc: "no", name: "Avinor (Norge)", url: "https://aim-prod.avinor.no" },
  { cc: "pl", name: "PANSA (Polska)", url: "https://www.ais.pansa.pl" },
  { cc: "se", name: "LFV (Sverige)", url: "https://aro.lfv.se" },
  {
    cc: "uk",
    name: "NATS (United Kingdom)",
    url: "https://nats-uk.ead-it.com",
  },
  { cc: "ee", name: "EANS (Eesti)", url: "https://eaip.eans.ee" },
  { cc: "fi", name: "Fintraffic ANS (Suomi)", url: "https://www.ais.fi" },
  { cc: "es", name: "ENAIRE (España)", url: "https://aip.enaire.es" },
  { cc: "lv", name: "LGS (Latvija)", url: "https://ais.lgs.lv" },
  { cc: "is", name: "Isavia (Ísland)", url: "https://eaip.isavia.is" },
  { cc: "pt", name: "NAV Portugal (Portugal)", url: "https://ais.nav.pt" },
  {
    cc: "hu",
    name: "HungaroControl (Magyarország)",
    url: "https://ais.hungarocontrol.hu",
  },
  {
    cc: "si",
    name: "Slovenia Control (Slovenija)",
    url: "https://aim.sloveniacontrol.si",
  },
  { cc: "lt", name: "Oro navigacija (Lietuva)", url: "https://www.ans.lt" },
  { cc: "rs", name: "SMATSA (Srbija)", url: "https://smatsa.rs" },
  { cc: "ie", name: "AirNav Ireland (Ireland)", url: "https://www.airnav.ie" },
  { cc: "sk", name: "LPS SR (Slovensko)", url: "https://aim.lps.sk" },
  {
    cc: "ba",
    name: "BHANSA (Bosna i Hercegovina)",
    url: "https://eaip.bhansa.gov.ba",
  },
  {
    cc: "ch",
    name: "skybriefing / skyguide (Schweiz)",
    url: "https://www.skybriefing.com",
  },
  { cc: "al", name: "Albcontrol (Shqipëri)", url: "https://www.albcontrol.al" },
  {
    cc: "mk",
    name: "M-NAV (Severna Makedonija)",
    url: "https://ais.m-nav.info",
  },
  { cc: "ro", name: "AISRO / ROMATSA (România)", url: "https://www.aisro.ro" },
  {
    cc: "cy",
    name: "DCA Cyprus (Κύπρος)",
    url: "http://vfrmanual.dca.mcw.gov.cy",
  },
  {
    cc: "mt",
    name: "MATS / Transport Malta (Malta)",
    url: "https://www.transport.gov.mt",
  },
  { cc: "md", name: "MOLDATSA (Moldova)", url: "https://aim.moldatsa.md" },
  { cc: "it", name: "ENAV (Italia)", url: "https://www.enav.it" },
  {
    cc: "hr",
    name: "Croatia Control (Hrvatska)",
    url: "https://www.crocontrol.hr",
  },
  { cc: "bg", name: "BULATSA (България)", url: "https://www.bulatsa.com" },
  { cc: "tr", name: "DHMI (Türkiye)", url: "https://dhmi.gov.tr" },
  {
    cc: "ge",
    name: "Sakaeronavigatsia (საქართველო)",
    url: "https://airnav.ge",
  },
  { cc: "am", name: "ARMATS (Հայաստան)", url: "https://armats.am" },
  {
    cc: "az",
    name: "AZANS / State Civil Aviation Agency (Azərbaycan)",
    url: "https://www.caa.gov.az",
  },
  { cc: "ua", name: "UkSATSE (Україна)", url: "https://www.aisukraine.net" },
  {
    cc: "uz",
    name: "Uzaeronavigation (Oʻzbekiston)",
    url: "https://uzaeronavigation.com",
  },
  {
    cc: "by",
    name: "Belaeronavigatsia (Беларусь)",
    url: "https://www.ban.by",
  },
  {
    cc: "kz",
    name: "Kazaeronavigatsia (Қазақстан)",
    url: "https://www.ans.kz",
  },
  { cc: "xk", name: "ASHNA / CAA Kosovo (Kosova)", url: "https://kans-ks.org" },
  { cc: "ru", name: "CAICA (Россия)", url: "https://www.caica.ru" },
  {
    cc: "tj",
    name: "Tajikairnavigation (Тоҷикистон)",
    url: "https://www.caica.ru/aiptjk",
  },
  {
    cc: "tm",
    name: "Turkmenhowayollary (Türkmenistan)",
    url: "https://www.caica.ru/aiptkm",
  },
  {
    cc: "kg",
    name: "Kyrgyzaeronavigatsia (Кыргызстан)",
    url: "https://ansp.kg",
  },
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
  const tCommon = await getTranslations("Common");

  return (
    <>
      <Title title={t("title")} description={t("intro")} />
      <div className="mx-auto mt-12 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="border-drossgray-dark/15 flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          <section>
            <SectionHeading
              className="text-xl font-semibold tracking-tight"
              linkTitle={`${t("title")} - ${t("servicesTitle")}`}
            >
              {t("servicesTitle")}
            </SectionHeading>
            <p className="mt-3">
              {t.rich("servicesText", {
                // The brand mention links to the global homepage (permanent
                // underline - color alone fails axe link-in-text-block).
                home: (chunks) => (
                  <Link
                    href="/"
                    title={tCommon("homeLink")}
                    className="text-drossblue underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </section>

          <section>
            <SectionHeading
              className="text-xl font-semibold tracking-tight"
              linkTitle={`${t("title")} - ${t("disclaimerTitle")}`}
            >
              {t("disclaimerTitle")}
            </SectionHeading>
            <p className="mt-3">{t("disclaimerText")}</p>
          </section>

          <section>
            <SectionHeading
              className="text-xl font-semibold tracking-tight"
              linkTitle={`${t("title")} - ${t("sourcesTitle")}`}
            >
              {t("sourcesTitle")}
            </SectionHeading>
            <p className="mt-3">{t("sourcesIntro")}</p>

            <SectionHeading
              as="h3"
              className="mt-5 font-medium"
              linkTitle={`${t("sourcesTitle")} - ${t("sourcesAip")}`}
            >
              {t("sourcesAip")}
            </SectionHeading>
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

            <SectionHeading
              as="h3"
              className="mt-5 font-medium"
              linkTitle={`${t("sourcesTitle")} - ${t("sourcesData")}`}
            >
              {t("sourcesData")}
            </SectionHeading>
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

      {/* Bottom breadcrumb (root > country > terms). The terms page never had
          BreadcrumbList JSON-LD - the shared component adds it, with the
          schema name falling back to the visible BreadCrumbs label. */}
      <BreadCrumbs locale={locale} page={{ href: "/terms" }} />
    </>
  );
}
