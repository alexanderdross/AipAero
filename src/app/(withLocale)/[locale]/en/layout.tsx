import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  unstable_setRequestLocale
} from 'next-intl/server';
import { locales } from '~/config';
import { TRPCReactProvider } from "~/trpc/react";
import Footer from "~/app/_components/footer";
import About from "~/app/_components/about";
import Breadcrumbs from "~/app/_components/breadcrumbs";
import Menu from "~/app/_components/menu";
import { LocaleSwitcher } from "~/app/_components/locale-switcher";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/*export async function generateMetadata({
  params: { locale }
}: Omit<Props, 'children'>) {
  const t = await getTranslations({ locale, namespace: 'LocaleLayout.english' });

  return {
    title: t('title')
  };
}*/

export default async function LocaleLayout({
  children,
  params: { locale }
}: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages({ locale: locale });

  return (
    <html lang={"en"} className={`${GeistSans.variable}`}>
      <body className="bg-drossgray">
        <TRPCReactProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
            <About english />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
              <div className="border border-[#ccc] p-4">
                <Menu />
                <LocaleSwitcher />
              </div>
            </div>
            <Breadcrumbs />
            <Footer english />
          </NextIntlClientProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}