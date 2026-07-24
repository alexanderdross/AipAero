import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { Fragment } from "react";
import { AboutBox } from "~/components/about-box";
import { Box } from "~/components/box";
import { AirportSearchBox } from "~/components/airport-search-box";
import { FavoritesRecent } from "~/components/favorites-recent";
import Footer from "~/components/footer";
import { Hero } from "~/components/hero";
import { Header } from "~/components/header";
import { ValueProps } from "~/components/value-props";
import {
  countryAnchorSlug,
  countryMeta,
  countryTypeAvailability,
  liveCountries,
  orgUrl,
  rootBreadcrumb,
  rootDescription,
  rootTitle,
  serpTitle,
} from "~/lib/utils";
import { HashDetailsOpener } from "~/components/hash-details-opener";
import { SectionHeading, slugify } from "~/components/section-heading";
import { SchemaProduct } from "~/components/schemas/schema-product";
import { SchemaOrganization } from "~/components/schemas/schema-organization";
import { SchemaDedupe } from "~/components/schema-dedupe";
import { ServiceWorkerRegistration } from "~/components/service-worker-registration";
import { WebVitalsReporter } from "~/components/web-vitals-reporter";
import { ClientErrorReporter } from "~/components/client-error-reporter";
import { modifiedDate as buildDate } from "~/lib/build-info";
import { inter } from "~/lib/fonts";
import { isSingleLocale, routing } from "~/i18n/routing";
import type { DeprecatedMetadataFields } from "next/dist/lib/metadata/types/metadata-types";

export async function generateMetadata(
  _props: { params: Promise<Record<string, never>> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const parentMetadata = await parent;
  const previousOpenGraph = parentMetadata.openGraph ?? {};
  const previousOther = parentMetadata.other ?? {};
  return {
    title: serpTitle(rootTitle),
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
      siteName: rootTitle,
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

  // English (uk) labels for the client-only Favorites/Recently-viewed card.
  const tCommon = await getTranslations("Common");

  // Only live countries appear in the SiteNavigation JSON-LD (hidden countries
  // must not be advertised to crawlers while their pages are empty).
  const liveLocales = routing.locales.filter((x) =>
    liveCountries.includes(x.replace("-EN", "")),
  );
  const localeTranslations = await Promise.all(
    liveLocales.map((x) =>
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

  // Country cards derive from `liveCountries` x `countryMeta` (~/lib/utils):
  // launching a country is a single un-comment in `liveCountries`, no edit
  // here. Single-locale countries (uk, be) get one button and no /en/ twin.
  const countries = liveCountries
    .map((tld) => ({
      tld,
      ...countryMeta[tld]!,
      isSingleLocale: isSingleLocale(tld),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Short, language-neutral labels for the chart types each country exposes,
  // shown as pills on its card so the grid hints at what is behind each link.
  const typeBadge: Record<string, string> = {
    vfr: "VFR",
    ifr: "IFR",
    heliport: "Heliport",
    mil: "Military",
    aeroport: "Aéroport",
  };

  const modifiedDate = new Date(buildDate);

  // FAQ entries - ONE array drives the visible section AND the FAQPage
  // JSON-LD below. `a` is the plain quotable prose (GEO + JSON-LD); the
  // optional `render` adds internal links to the VISIBLE copy only
  // (accordion conventions in CLAUDE.md - links carry a permanent underline,
  // axe link-in-text-block).
  const inlineLink = "text-drossblue underline";
  const faq: { q: string; a: string; render?: React.ReactNode }[] = [
    {
      q: "What is an AIP (Aeronautical Information Publication)?",
      a: "An AIP is the official aeronautical manual a state publishes for pilots: aerodrome data, operational procedures and approach charts, maintained by the national air navigation service provider (DFS in Germany, Austro Control in Austria, and so on) and amended in the 28-day AIRAC cycle. AIP:Aero links you straight to these official publications.",
      render: (
        <>
          An{" "}
          <Link
            href="/uk/glossary/"
            title="Aviation glossary: AIP, eAIP, AIRAC, VFR/IFR, METAR/TAF and chart types explained"
            className={inlineLink}
          >
            AIP
          </Link>{" "}
          is the official aeronautical manual a state publishes for pilots:
          aerodrome data, operational procedures and approach charts, maintained
          by the national air navigation service provider (DFS in Germany,
          Austro Control in Austria, and so on) and amended in the 28-day{" "}
          <Link
            href="/uk/glossary/"
            title="Aviation glossary: what the AIRAC cycle is and why it matters"
            className={inlineLink}
          >
            AIRAC
          </Link>{" "}
          cycle. AIP:Aero links you straight to these official publications.
        </>
      ),
    },
    {
      q: "Where can I get free VFR and IFR approach charts?",
      a: "Most European countries publish their AIP including approach charts free of charge - they are just hard to find and search. Pick a country above, choose VFR, IFR or heliports and open the aerodrome: AIP:Aero links the official chart (usually a PDF) for every listed field, no account needed.",
      render: (
        <>
          Most European countries publish their AIP including approach charts
          free of charge - they are just hard to find and search. Pick a{" "}
          <a
            href="#countries"
            title="All covered countries on this page"
            className={inlineLink}
          >
            country above
          </a>
          , choose VFR, IFR or heliports and open the aerodrome: AIP:Aero links
          the official chart (usually a PDF) for every listed field, no account
          needed.
        </>
      ),
    },
    {
      q: "How do I find an airport by its ICAO code, like EDDF or LFPG?",
      a: "Type the ICAO code or the airport name into the search box at the top - it searches all countries at once. Every aerodrome also has its own permanent page (for example aip.aero/de/en/vfr/?EDDF) with the approach chart, runways, frequencies and live weather.",
      render: (
        <>
          Type the ICAO code or the airport name into the search box at the top
          - it searches all countries at once. Every aerodrome also has its own
          permanent page (for example{" "}
          <Link
            href="/de/en/vfr/?EDDF"
            title="AIP VFR chart, weather and airport data for Frankfurt (EDDF)"
            className={inlineLink}
          >
            aip.aero/de/en/vfr/?EDDF
          </Link>
          ) with the approach chart, runways, frequencies and live weather.
        </>
      ),
    },
    {
      q: "Are the charts up to date and official?",
      a: "Every chart link points to the current edition of the national AIP, which is amended in the AIRAC cycle; where the source publishes it, we show the chart's AIRAC date. AIP:Aero republishes nothing - and as with any briefing tool, always verify against the official publication before flight.",
    },
    {
      q: "Which countries are covered?",
      a: `AIP:Aero currently covers ${liveCountries.length} European countries, from Austria to the United Kingdom - the full list with all chart types is right on this page, and coverage keeps growing.`,
      render: (
        <>
          AIP:Aero currently covers {liveCountries.length} European countries,
          from Austria to the United Kingdom - the{" "}
          <a
            href="#countries"
            title="All covered countries with their chart types"
            className={inlineLink}
          >
            full list with all chart types
          </a>{" "}
          is right on this page, and coverage keeps growing.
        </>
      ),
    },
    {
      q: "Can I use AIP:Aero offline or on my EFB tablet?",
      a: "Yes - AIP:Aero installs as an app (PWA) on iPad, Android and desktop, and you can save single aerodromes or whole country packs for offline use. See the EFB guide.",
      render: (
        <>
          Yes - AIP:Aero installs as an app (PWA) on iPad, Android and desktop,
          and you can save single aerodromes or whole country packs for offline
          use.{" "}
          <Link
            href="/uk/efb/"
            title="AIP:Aero on your EFB - install, offline charts, import"
            className={inlineLink}
          >
            See the EFB guide
          </Link>
          .
        </>
      ),
    },
    {
      q: "Where can I learn to read a chart or decode METAR and TAF?",
      a: "Our pilot guides walk through reading a VFR/IFR approach chart, understanding the AIRAC cycle and decoding METAR and TAF, and the aviation glossary explains the key terms - AIP, eAIP, AIRAC, VFR/IFR, ICAO codes and chart types.",
      render: (
        <>
          Our{" "}
          <Link
            href="/uk/guides/"
            title="Pilot guides: reading approach charts, the AIRAC cycle, decoding METAR/TAF"
            className={inlineLink}
          >
            pilot guides
          </Link>{" "}
          walk through reading a VFR/IFR approach chart, understanding the AIRAC
          cycle and decoding METAR and TAF, and the{" "}
          <Link
            href="/uk/glossary/"
            title="Aviation glossary: AIP, eAIP, AIRAC, VFR/IFR, METAR/TAF and chart types explained"
            className={inlineLink}
          >
            aviation glossary
          </Link>{" "}
          explains the key terms - AIP, eAIP, AIRAC, VFR/IFR, ICAO codes and
          chart types.
        </>
      ),
    },
  ];

  // A-Z jump bar: letters with at least one live country link to the FIRST
  // card of that letter (the cards are sorted alphabetically, so the rest
  // follow right below); empty letters render muted. Plain #-anchors, zero
  // client JS - the fragment shows in the URL bar, and /germany-style short
  // URLs 308-redirect to /#germany in middleware.ts.
  const alphabet = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(65 + i),
  );
  const firstCountryByLetter = new Map<
    string,
    { slug: string; names: string[] }
  >();
  for (const c of countries) {
    const letter = c.name[0]!.toUpperCase();
    const entry = firstCountryByLetter.get(letter);
    if (entry) {
      entry.names.push(c.name);
    } else {
      firstCountryByLetter.set(letter, {
        slug: countryAnchorSlug(c.name),
        names: [c.name],
      });
    }
  }

  return (
    <html className={`h-full scroll-smooth ${inter.variable}`} lang="en">
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
          {/* Sitelinks Search Box: Google may render a search box under the
              site's search result. The target URL must execute the search -
              the VALUELESS query key (https://aip.aero/?EDNY, the site's SEO
              scheme, same as the ?ICAO airport-detail URLs) is picked up by
              AirportSearchBox on mount. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": `${orgUrl.toString()}#website`,
                url: orgUrl.toString(),
                name: "AIP:Aero",
                alternateName: rootTitle,
                publisher: { "@id": `${orgUrl.toString()}#organization` },
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    // orgUrl carries the trailing slash: https://aip.aero/?...
                    urlTemplate: `${orgUrl.toString()}?{search_term_string}`,
                  },
                  // maxlength mirrors the server action's search validation.
                  "query-input":
                    "required maxlength=50 name=search_term_string",
                },
              }),
            }}
          />
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
                // One multi-typed node: the homepage navigation
                // (SiteNavigationElement), the collection (CollectionPage) and
                // the ordered ItemList that carries the per-country nav entries.
                "@type": [
                  "SiteNavigationElement",
                  "CollectionPage",
                  "ItemList",
                ],
                name: rootTitle,
                url: orgUrl.toString(),
                itemListElement: [
                  {
                    "@type": "SiteNavigationElement",
                    position: 1,
                    name: rootTitle,
                    alternateName: "AIP:Aero",
                    description: rootDescription,
                    inLanguage: "en",
                    url: orgUrl.toString(),
                  },
                  ...localeElements.map((x, i) => ({
                    "@type": "SiteNavigationElement",
                    position: i + 2,
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
          <SchemaOrganization />
          <SchemaProduct
            name={serpTitle(rootTitle)}
            alternateName="AIP:Aero"
            description={rootDescription}
            publishedDate={modifiedDate}
            currentUrl={orgUrl.toString()}
          />

          {/* Hero: headline plus the global cross-country search as the
              primary call to action. */}
          <Hero title={rootTitle} description={rootDescription}>
            <AirportSearchBox
              placeholder="Search any airport across Europe by name or ICAO code"
              noResultsLabel="No airports found"
              clearLabel={tCommon("clearSearch")}
            />
          </Hero>

          {/* Trust strip */}
          <ValueProps />

          {/* A-Z country jump bar */}
          <nav
            aria-label="Jump to a country by letter"
            className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8"
          >
            <ul className="flex flex-wrap justify-center gap-1">
              {alphabet.map((letter) => {
                const entry = firstCountryByLetter.get(letter);
                return (
                  <li key={letter}>
                    {entry ? (
                      <a
                        href={`#${entry.slug}`}
                        title={`Jump to AIP ${entry.names.join(", ")}`}
                        className="text-drossblue inline-flex min-h-10 min-w-10 items-center justify-center rounded-md font-semibold hover:bg-white hover:underline"
                      >
                        {letter}
                      </a>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="text-drossgray-dark/40 inline-flex min-h-10 min-w-10 items-center justify-center"
                      >
                        {letter}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Country Boxes - id="countries": anchor target for the FAQ's
              internal links and any external deep link to the country grid. */}
          <div
            id="countries"
            className="mx-auto mt-4 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8"
          >
            <div
              className={"grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"}
            >
              {countries.map((e) => (
                <Box
                  key={e.name}
                  id={countryAnchorSlug(e.name)}
                  lang="en"
                  icon={<span className="text-3xl">{e.flag}</span>}
                  title={`AIP ${e.name}`}
                  description={`Browse AIP of ${e.name} and download airport approach charts`}
                  badges={(countryTypeAvailability[e.tld] ?? []).map(
                    (t) => typeBadge[t] ?? t,
                  )}
                  buttons={
                    e.isSingleLocale
                      ? [
                          {
                            title: `AIP ${e.name} in ${e.nativeLang}`,
                            hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                            href: `/${e.tld}/`,
                            variant: "primary" as const,
                          },
                        ]
                      : [
                          {
                            title: `AIP ${e.name} in English`,
                            hrefTitle: `AIP ${e.name} in English`,
                            href: `/${e.tld}/en/`,
                            variant: "primary" as const,
                          },
                          {
                            title: `AIP ${e.name} in ${e.nativeLang}`,
                            hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                            href: `/${e.tld}/`,
                            variant: "secondary" as const,
                          },
                        ]
                  }
                />
              ))}
            </div>
          </div>

          {/* Favorites / recently viewed (client-only, localStorage) for
              returning pilots, so their saved fields are reachable straight from
              the homepage - not only after picking a country. Rendered BELOW the
              country grid so its post-hydration appearance stays below the
              initial fold and never shifts the indexable hero/cards (same CLS
              discipline as the country landing page). `hideWhenEmpty` renders
              nothing for first-time visitors (no card, no shift, no dead gap);
              the `mt-16` spacing lives on the component so it applies only when
              the card actually renders. Never in the SSR DOM (personal data),
              so SEO/LCP stay untouched. */}
          <FavoritesRecent
            hideWhenEmpty
            className="mt-16"
            favoritesLabel={tCommon("favorites")}
            recentLabel={tCommon("recentlyViewed")}
            favoritesEmptyLabel={tCommon("favoritesEmpty")}
            recentEmptyLabel={tCommon("recentlyViewedEmpty")}
          />

          {/* FAQ: visible text + matching FAQPage JSON-LD from ONE array
              (never markup-only - Google requires the schema to mirror
              visible content). Questions distilled from the Search Console
              query data (13.07.2026): the generic "aip" head term, the
              free-VFR-charts cluster, the huge bare-ICAO / "<ICAO> charts"
              cluster, per-country queries and the AIRAC/trust angle. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                // @id/url per question = its hash deep link (the accordion
                // ids) - a directly citable jump target for crawlers/LLMs.
                "@id": `${orgUrl.toString()}#frequently-asked-questions`,
                url: orgUrl.toString(),
                mainEntity: faq.map(({ q, a }) => {
                  const anchor = `${orgUrl.toString()}#${slugify(q)}`;
                  return {
                    "@type": "Question",
                    "@id": anchor,
                    url: anchor,
                    name: q,
                    acceptedAnswer: { "@type": "Answer", text: a },
                  };
                }),
              }),
            }}
          />
          {/* max-w-3xl: the card hugs its content instead of floating text in
              a much wider box; native <details> accordion: no client JS,
              SSR-collapsed (no CLS), answers stay in the crawlable HTML. */}
          <div className="mx-auto mt-16 max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="border-drossgray-dark/15 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
              <HashDetailsOpener />
              <SectionHeading
                linkTitle="Frequently asked questions about AIPs & approach charts in Europe"
                className="text-center text-xl font-semibold tracking-tight"
              >
                Frequently asked questions
              </SectionHeading>
              <div className="divide-drossgray-dark/10 mt-4 divide-y">
                {faq.map(({ q, a, render }) => {
                  const slug = slugify(q);
                  return (
                    <details
                      key={q}
                      id={slug}
                      className="group scroll-mt-24 py-1"
                    >
                      <summary
                        title={q}
                        className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-x-2 py-2 [&::-webkit-details-marker]:hidden"
                      >
                        <h3 className="font-semibold">{q}</h3>
                        <span
                          aria-hidden="true"
                          className="text-drossgray-dark shrink-0 transition-transform group-open:rotate-90"
                        >
                          ›
                        </span>
                      </summary>
                      <p className="text-drossgray-dark pb-3">{render ?? a}</p>
                    </details>
                  );
                })}
              </div>
            </div>
          </div>

          {/* About Box */}
          <AboutBox title="About this website" isH3={true}>
            This website aims to simplify the search for approach charts and
            Aeronautical Information Publications (AIPs) for aerodromes,
            airports, and airfields in{" "}
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
            . We do not accept any liability for the accuracy or timeliness of
            the AIPs, as they are not published by us. We only provide
            convenient links to the respective approach charts.
          </AboutBox>
        </main>

        <Footer global />
        {/* Offline PWA: registers /sw.js after load (production hosts only). */}
        <ServiceWorkerRegistration />
        {/* First-party Web-Vitals beacon (production hosts only). */}
        <WebVitalsReporter />
        {/* First-party client-error beacon -> Sentry (production hosts only). */}
        <ClientErrorReporter />
        {/* Merge byte-identical duplicate JSON-LD nodes (Workers serving-path
            artifact - see the component's doc comment). */}
        <SchemaDedupe />
      </body>
    </html>
  );
}
