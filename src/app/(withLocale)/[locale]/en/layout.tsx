import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { TRPCReactProvider } from "~/trpc/react";
import Footer from "~/app/_components/footer";
import About from "~/app/_components/about";
import Breadcrumbs from "~/app/_components/breadcrumbs";
import Menu from "~/app/_components/menu";
import { LocaleSwitcher } from "~/app/_components/locale-switcher";
import { getTranslation, getTranslations } from "~/lib/i18n";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return getTranslations({}).map((country) => ({ locale: country.Tld }));
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: Props) {
  const translation = getTranslation({ tld: locale, english: true });
  
  return (
    <html lang={"en"} className={`${GeistSans.variable}`}>
      <body className="bg-drossgray">
        <TRPCReactProvider>
            {children}
            <About translation={translation.About} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
              <div className="border border-[#ccc] p-4">
                <Menu translation={translation} />
                <LocaleSwitcher translation={translation.LocaleSwitcher} locale={locale} />
              </div>
            </div>
            <Breadcrumbs translation={translation} />
            <Footer translation={translation.Footer}/>
        </TRPCReactProvider>
      </body>
    </html>
  );
}