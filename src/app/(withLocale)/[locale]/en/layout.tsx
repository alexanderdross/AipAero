import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  unstable_setRequestLocale
} from 'next-intl/server';
import { locales } from '~/config';
import { TRPCReactProvider } from "~/trpc/react";
import Footer from "~/app/_components/footer";
import About from "~/app/_components/about";
import Breadcrumbs from "~/app/_components/breadcrumbs";
import Menu from "~/app/_components/menu";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale }
}: Omit<Props, 'children'>) {
  const englishLocale = locale + '/en';
  const t = await getTranslations({ englishLocale, namespace: 'LocaleLayout' });

  return {
    title: t('title')
  };
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: Props) {
  const englishLocale = locale + '/en';
  // Enable static rendering
  unstable_setRequestLocale(englishLocale);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages({ locale: englishLocale });

  return (
    <html lang={"en"}>
      <body className={`${GeistSans.variable}`}>
        <TRPCReactProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
            <About />
            <Menu />
            <Breadcrumbs />
            <Footer />
          </NextIntlClientProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}