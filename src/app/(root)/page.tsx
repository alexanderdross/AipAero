import { getTranslations } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import { Box } from "~/app/_components/box";
import Link from "next/link";
import Metadata, { orgUrl } from "~/app/_components/metadata";
import { SchemaRootNavigation } from "~/app/_components/schemas/schema-root-navigation";
import { SchemaProduct } from "~/app/_components/schemas/schema-product";
import { Fragment } from "react";

export default async function Home() {
  const countries = await getTranslations({});
  const countryNames = countries.map(i => i.Country);
  const countriesAsSentence = countryNames.slice(0, -1).join(', ') + ' and ' + countryNames.slice(-1)[0];

  const title = `AIP and approach charts of ${countriesAsSentence}`;
  const metaTitle = `🛩️ AIP and approach charts of ${countriesAsSentence}`;

  const description = `Free download of Aeronautical Information Publication (AIP) and approach 
    charts of aerodromes/ airports/ airfields in ${countriesAsSentence}.`;
  const metaDescription = `Free download of 🛩️ Aeronautical Information Publication (AIP) and approach 
    charts of airports/ airfields in ${countriesAsSentence}.`;

  const aboutPart1 = 'This website aims to simplify the search for approach charts and Aeronautical Information Publication (AIP) for aerodromes, airports, and airfields in ';
  const aboutPart2 = '. We are not liable for the correctness and accuracy of AIPs (Aeronautical Information Publication), as these are not operated by us. We merely provide convenient links to corresponding approach charts.'

  return (
    <>
      <Metadata
        title={metaTitle}
        description={metaDescription}
        href="/"
        alternates={countries.map((e) => [{
          href: e.CountryPage.href,
          hrefLang: e.CountryPage.ietfLang
        }, {
          href: e.CountryPage.alternate,
          hrefLang: e.CountryPage.alternateIetfLang
        }]).flat(1)}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [{
              "@type": "ListItem",
              "position": 1,
              "item": {
                "@id": orgUrl.toString(),
                "name": title,
                "alternateName": "AIP:Aero",
                "description": description
              }
            }]
          })
        }}
      />

      <SchemaRootNavigation />
      <SchemaProduct
        name={title}
        alternateName="AIP:Aero"
        description={description}
      />

      <Header className={"pt-[40px]"} title={title} description={description} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={"grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
          {countries.map((e) => (
            <Box
              key={e.Country}
              title={`AIP ${e.Country} ${e.Flag}`}
              description={`Browse AIP of ${e.Country} and download airport approach charts`}
              buttons={e.isSingleLocale ? [
                {
                  title: `AIP ${e.Country} in ${e.Language}`,
                  hrefTitle: `AIP ${e.Country} in ${e.Language}`,
                  href: `/${e.Tld}/`,
                }
              ] : [
                {
                  title: `AIP ${e.Country} in English`,
                  hrefTitle: `AIP ${e.Country} in English`,
                  href: `/${e.Tld}/en/`,
                },
                {
                  title: `AIP ${e.Country} in ${e.Language}`,
                  hrefTitle: `AIP ${e.Country} in ${e.Language}`,
                  href: `/${e.Tld}/`,
                },
              ]}
            />
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-center items-center text-center mt-16 border border-[#ccc] p-4">
          <h3 className="!text-[1.125rem] font-medium">About this website</h3>
          <p>
            {aboutPart1}
            {countries.map((e, idx) => (<Fragment key={e.Country}>
              <Link
                className="text-drossblue hover:underline"
                href={`/${e.Tld}/`}
                title={`Aeronautical Information Publication (AIP) of ${e.Country}`}
                target="_self"
                rel="noopener"
              >
                {e.Country}
              </Link>
              {idx <= countries.length - 2 ? idx === countries.length - 2 ? ' and ' : ', ' : ''}
            </Fragment>
            ))}
            {aboutPart2}
          </p>
        </div>
      </div>
    </>
  );
}
