'use server';

import { Box } from "~/app/_components/box";
import { Header } from "~/app/_components/header";
import { generateProductSchema } from "~/lib/generate-schema";
import type { Translation } from "~/lib/i18n";
import Metadata from "./metadata";

export async function ContentCountryPage({ translation }: { translation: Translation }) {
  const title = translation.CountryPage.title;
  const description = translation.CountryPage.description;
  return (
    <>
      <Metadata
        title={title}
        description={description}
        url={translation.CountryPage.href}
        alternates={translation.CountryPage.alternate && translation.CountryPage.alternateIetfLang
          ? [{ href: translation.CountryPage.href, hrefLang: translation.CountryPage.ietfLang },
          { href: translation.CountryPage.alternate, hrefLang: translation.CountryPage.alternateIetfLang }]
          : [{ href: translation.CountryPage.href, hrefLang: translation.CountryPage.ietfLang }]}
      />
      {generateProductSchema(
        title, // name
        `AIP ${translation.Country}`, // alternateName
        description, // description
        translation.CountryPage.href // href
      )}
      <Header title={title} description={description} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-6">
          <Box
            title={translation.VfrPage.title}
            description={translation.VfrPage.description}
            buttons={[{ href: translation.VfrPage.href, hrefTitle: translation.VfrPage.hrefTitle, title: translation.VfrPage.hrefTitle }]}
          />
          {translation.IfrPage && <Box
            title={translation.IfrPage.title}
            description={translation.IfrPage.description}
            buttons={[{ href: translation.IfrPage.href, hrefTitle: translation.IfrPage.hrefTitle, title: translation.IfrPage.hrefTitle }]}
          />}
          <Box
            title={translation.HeliportPage.title}
            description={translation.HeliportPage.description}
            buttons={[{ href: translation.HeliportPage.href, hrefTitle: translation.HeliportPage.hrefTitle, title: translation.HeliportPage.hrefTitle }]}
          />
        </div>
      </div>
    </>
  );
}