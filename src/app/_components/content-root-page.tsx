"use server";

import { generateNavigationSchema, generateProductSchema } from "~/lib/generate-schema";
import type { Translation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import { Box } from "~/app/_components/box";
import Link from "next/link";
import Metadata from "~/app/_components/metadata";

export async function ContentRootPage({ translations }: { translations: Translation[] }) {
  const countryNames = translations.map(i => i.Country);
  const countriesAsSentence = countryNames.slice(0, -1).join(', ') + ' and ' + countryNames.slice(-1)[0];

  const title = `AIP and approach charts of ${countriesAsSentence}`;
  const description = `Free download of Aeronautical Information Publication (AIP) and approach 
    charts of aerodromes/ airports/ airfields in ${countriesAsSentence}.`;

  return (
    <>
      <Metadata
        title={title}
        description={description}
        url="/"
      />
      {generateNavigationSchema()}
      {generateProductSchema(title, 'AIP:Aero', description)}
      <Header title={title} description={description} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-6">
          {translations.map((e) => (
            <Box
              key={e.Country}
              title={`AIP ${e.Country}`}
              description={`Browse AIP of ${e.Country} and download airport approach charts`}
              buttons={e.isSingleLocale ? [
                {
                  title: `AIP ${e.Country} in ${e.Language}`,
                  hrefTitle: `Open AIP ${e.Country} in ${e.Language}`,
                  href: `/${e.Tld}/`,
                }
              ] : [
                {
                  title: `AIP ${e.Country} in English`,
                  hrefTitle: `Open AIP ${e.Country} in English`,
                  href: `/${e.Tld}/en/`,
                },
                {
                  title: `AIP ${e.Country} in ${e.Language}`,
                  hrefTitle: `Open AIP ${e.Country} in ${e.Language}`,
                  href: `/${e.Tld}/`,
                },
              ]}
            />
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-center items-center text-center mt-16">
          <div className="border border-[#ccc] p-4">
            <h3 className="!text-[1.125rem] font-medium">About this website</h3>
            <p>This website aims to simplify the search for approach charts and Aeronautical Information Publication (AIP) for aerodromes, airports, and airfields in {
              translations.map((e, idx) => (<span key={e.Country}>
                <Link
                  className="text-drossblue hover:underline"
                  href={`/${e.Tld}/`}
                  title={`Aeronautical Information Publication (AIP) of ${e.Country}`}
                  target="_self"
                  rel="noopener"
                >
                  {e.Country}
                </Link>
                {idx <= translations.length - 2 ? idx === translations.length - 2 ? ' and ' : ', ' : ''}
              </span>
              ))}. We are not liable for the correctness and accuracy of AIPs (Aeronautical Information Publication), as these are not operated by us. We merely provide convenient links to corresponding approach charts.</p>
          </div>
        </div>
      </div>
    </>
  );
}