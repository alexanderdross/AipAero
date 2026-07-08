import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { Fragment } from "react";
import { AboutBox } from "~/components/about-box";
import { Box } from "~/components/box";
import Footer from "~/components/footer";
import { Title } from "~/components/title";
import { Header } from "~/components/header";
import {
  orgUrl,
  rootBreadcrumb,
  rootDescription,
  rootTitle,
} from "~/lib/utils";
import { SchemaProduct } from "~/components/schemas/schema-product";
import { modifiedDate as buildDate } from "~/lib/build-info";
import { routing } from "~/i18n/routing";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";

export async function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  return {
    title: `🛩️ ${rootTitle}`,
    description: `🛩️ ${rootDescription}`,
    alternates: {
      canonical: orgUrl,
      languages: {
        "x-default": orgUrl,
      },
    },
    openGraph: {
      ...previousOpenGraph,
      url: orgUrl.toString(),
      siteName: `🛩️ ${rootTitle}`,
    },
    other: {
      ...(previousOther as Omit<
        Metadata["other"],
        keyof DeprecatedMetadataFields
      >),
      "twitter:url": orgUrl.toString(),
      abstract: `🛩️ ${rootDescription}`,
      "og:image:alt": rootTitle,
    },
  };
}

export default async function RootPage() {
  setRequestLocale("uk");

  const localeTranslations = await Promise.all(
    routing.locales.map((x) =>
      getTranslations({ locale: x, namespace: "CountrySiteNavElement" }),
    ),
  );
  const localeElements = localeTranslations.map((x) => ({
    name: x("name"),
    alternateName: x("alternateName"),
    description: x("description"),
    inLanguage: x("inLanguage"),
    url: x("url"),
  }));

  const countries = [
    {
      tld: "uk",
      lang: "en",
      name: "United Kingdom",
      flag: "🇬🇧",
      nativeLang: "English",
      isSingleLocale: true,
    },
    {
      tld: "de",
      lang: "de",
      name: "Germany",
      flag: "🇩🇪",
      nativeLang: "German",
    },
    {
      tld: "fr",
      lang: "fr",
      name: "France",
      flag: "🇫🇷",
      nativeLang: "French",
    },
    {
      tld: "nl",
      lang: "nl",
      name: "Netherlands",
      flag: "🇳🇱",
      nativeLang: "Dutch",
    },
    {
      tld: "at",
      lang: "de",
      name: "Austria",
      flag: "🇦🇹",
      nativeLang: "German",
    },
    {
      tld: "be",
      lang: "en",
      name: "Belgium & Luxembourg",
      flag: "🇧🇪",
      nativeLang: "English",
      isSingleLocale: true,
    },
    {
      tld: "cz",
      lang: "cs",
      name: "Czechia",
      flag: "🇨🇿",
      nativeLang: "Czech",
    },
    {
      tld: "dk",
      lang: "da",
      name: "Denmark",
      flag: "🇩🇰",
      nativeLang: "Danish",
    },
    {
      tld: "gr",
      lang: "el",
      name: "Greece",
      flag: "🇬🇷",
      nativeLang: "Greek",
    },
    {
      tld: "no",
      lang: "no",
      name: "Norway",
      flag: "🇳🇴",
      nativeLang: "Norwegian",
    },
    {
      tld: "pl",
      lang: "pl",
      name: "Poland",
      flag: "🇵🇱",
      nativeLang: "Polish",
    },
    {
      tld: "se",
      lang: "sv",
      name: "Sweden",
      flag: "🇸🇪",
      nativeLang: "Swedish",
    },
  ].sort((a, b) => a.name.localeCompare(b.name));

  const modifiedDate = new Date(buildDate);

  return (
    <html className="h-full" lang="en">
      {/* We cant set the alternate links via metadata api, since it disallows the use of duplicate hrefLang */}
      <head>
        {countries.map((e) => (
          <link
            key={e.name}
            rel="alternate"
            hrefLang={e.lang}
            href={`https://aip.aero/${e.tld}/`}
          />
        ))}
        {countries
          .filter((e) => !e.isSingleLocale)
          .map((e) => (
            <link
              key={e.name}
              rel="alternate"
              hrefLang="en"
              href={`https://aip.aero/${e.tld}/en/`}
            />
          ))}
      </head>

      <body className={"bg-drossgray font-sans"}>
        <Header />

        <main>
          <Title title={rootTitle} description={rootDescription} />

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [rootBreadcrumb],
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@graph": [
                  {
                    "@context": "https://schema.org",
                    "@type": "SiteNavigationElement",
                    name: rootTitle,
                    alternateName: "AIP:Aero",
                    description: rootDescription,
                    inLanguage: "en",
                    url: orgUrl.toString(),
                  },
                  ...localeElements.map((x) => ({
                    "@context": "https://schema.org",
                    "@type": "SiteNavigationElement",
                    name: x.name,
                    alternateName: x.alternateName,
                    description: x.description,
                    inLanguage: x.inLanguage,
                    url: x.url,
                  })),
                ],
              }),
            }}
          />
          <SchemaProduct
            name={rootTitle}
            alternateName="AIP:Aero"
            description={rootDescription}
            publishedDate={modifiedDate}
            currentUrl={orgUrl.toString()}
          />

          {/* Country Boxes */}
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div
              className={"grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"}
            >
              {countries.map((e) => (
                <Box
                  key={e.name}
                  title={`AIP ${e.name} ${e.flag}`}
                  description={`Browse AIP of ${e.name} and download airport approach charts`}
                  buttons={
                    e.isSingleLocale
                      ? [
                          {
                            title: `AIP ${e.name} in ${e.nativeLang}`,
                            hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                            href: `/${e.tld}/`,
                          },
                        ]
                      : [
                          {
                            title: `AIP ${e.name} in English`,
                            hrefTitle: `AIP ${e.name} in English`,
                            href: `/${e.tld}/en/`,
                          },
                          {
                            title: `AIP ${e.name} in ${e.nativeLang}`,
                            hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                            href: `/${e.tld}/`,
                          },
                        ]
                  }
                />
              ))}
            </div>
          </div>

          {/* About Box */}
          <AboutBox title="About this website" isH3={true}>
            This website aims to simplify the search for approach charts and
            Aeronautical Information Publication (AIP) for aerodromes, airports,
            and airfields in{" "}
            {countries.map((e, idx) => (
              <Fragment key={e.name}>
                <Link
                  className="text-drossblue hover:underline"
                  href={`/${e.tld}/`}
                  title={`Aeronautical Information Publication (AIP) of ${e.name}`}
                  target="_self"
                  rel="noopener"
                >
                  {e.name}
                </Link>
                {idx <= countries.length - 2
                  ? idx === countries.length - 2
                    ? " and "
                    : ", "
                  : ""}
              </Fragment>
            ))}
            . We are not liable for the correctness and accuracy of AIPs
            (Aeronautical Information Publication), as these are not operated by
            us. We merely provide convenient links to corresponding approach
            charts.
          </AboutBox>
        </main>

        <Footer />
      </body>
    </html>
  );
}
