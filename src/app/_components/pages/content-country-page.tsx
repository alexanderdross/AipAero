'use server';

import { Box } from "~/app/_components/box";
import { Header } from "~/app/_components/header";
import type { Translation } from "~/lib/i18n";
import Metadata from "~/app/_components/metadata";
import clsx from "clsx";
import { SchemaProduct } from "../schemas/schema-product";

export async function ContentCountryPage({ 
  translation 
}: { translation: Translation }) {
  const title = translation.CountryPage.title;
  const description = translation.CountryPage.description;
  return (
    <>
      <Metadata
        title={title}
        description={description}
        href={translation.CountryPage.href}
        alternates={translation.CountryPage.alternate && translation.CountryPage.alternateIetfLang
          ? [{ href: translation.CountryPage.href, hrefLang: translation.CountryPage.ietfLang },
          { href: translation.CountryPage.alternate, hrefLang: translation.CountryPage.alternateIetfLang }]
          : [{ href: translation.CountryPage.href, hrefLang: translation.CountryPage.ietfLang }]}
      />
      <SchemaProduct
        name={title}
        alternateName={`AIP ${translation.Country}`}
        description={description}
      />
      <Header title={title} description={description} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={clsx("grid gap-6 grid-cols-1 md:grid-cols-2", translation.IfrPage ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          <Box
            title={translation.VfrPage.countryPageTitle}
            description={translation.VfrPage.countryPageDescription}
            buttons={[{ href: translation.VfrPage.href, hrefTitle: translation.VfrPage.hrefTitle, title: translation.VfrPage.countryPageButtonTitle }]}
          />
          {translation.IfrPage && <Box
            title={translation.IfrPage.countryPageTitle}
            description={translation.IfrPage.countryPageDescription}
            buttons={[{ href: translation.IfrPage.href, hrefTitle: translation.IfrPage.hrefTitle, title: translation.IfrPage.countryPageButtonTitle }]}
          />}
          <Box
            title={translation.HeliportPage.countryPageTitle}
            description={translation.HeliportPage.countryPageDescription}
            buttons={[{ href: translation.HeliportPage.href, hrefTitle: translation.HeliportPage.hrefTitle, title: translation.HeliportPage.countryPageButtonTitle }]}
          />
        </div>
      </div>
    </>
  );
}