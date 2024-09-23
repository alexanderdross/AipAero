'use server';

import clsx from "clsx";
import { Box } from "~/app/_components/box";
import { Header } from "~/app/_components/header";
import { generateProductSchema } from "~/lib/generate-schema";
import type { Translation } from "~/lib/i18n";

export async function ContentCountryPage({ translation }: { translation: Translation }) {
  const title = translation.CountryPage.title;
  const description = translation.CountryPage.description;
  return (
    <>
      {generateProductSchema(title, `AIP ${translation.Country}`, description)}
      <Header title={title} description={description} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul role="list" className={clsx("grid grid-cols-1 gap-6 sm:grid-cols-2", translation.IfrPage && "lg:grid-cols-3")}>
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
        </ul>
      </div>
    </>
  );
}