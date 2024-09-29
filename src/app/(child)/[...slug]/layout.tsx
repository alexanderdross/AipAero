import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { TRPCReactProvider } from "~/trpc/react";
import Footer from "~/app/_components/footer";
import About from "~/app/_components/about";
import Breadcrumbs from "~/app/_components/breadcrumbs";
import Menu from "~/app/_components/menu";
import { LocaleSwitcher } from "~/app/_components/locale-switcher";
import { getTranslation, type Translation } from "~/lib/i18n";
import { notFound } from "next/navigation";

// Needed for build with TRPC to succeed
export const dynamic = 'force-dynamic';

// All slugs besides the static ones will be 404
export const dynamicParams = false;

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { countryCode: string; slug: string[]; };
}) {
  const countryCode = params.slug.at(0);
  if (!countryCode) {
    return notFound();
  }
  const isEnglish = params.slug.at(1) === "en";

  // Get translation depending on countryCode code and language
  let translation: Translation;
  try {
    translation = getTranslation({ tld: countryCode, english: isEnglish });
  } catch {
    return notFound();
  }

  return (
    <html lang={translation.LanguageCode} className={`${GeistSans.variable}`}>
      <body className="bg-drossgray">
        <TRPCReactProvider>
          {children}
          <About translation={translation.About} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="border border-[#ccc] p-4">
              <Menu translation={translation} />
              <LocaleSwitcher translation={translation} />
            </div>
          </div>
          <Breadcrumbs translation={translation} />
          <Footer translation={translation.Footer} />
        </TRPCReactProvider>
      </body>
    </html>
  );
}