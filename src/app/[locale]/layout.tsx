import {notFound} from 'next/navigation';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {localeLangMapping, routing} from '~/i18n/routing';
import { NextIntlClientProvider } from 'next-intl';
import Footer from '~/components/footer';
import { AboutCountryBox } from '~/components/about-country-box';
import { Header } from '~/components/header';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout(props: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string; }>;
}>) {
  const { locale } = await props.params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html className="h-full" lang={localeLangMapping[locale]}>
      <body className={'bg-drossgray font-sans'}>
        <NextIntlClientProvider messages={messages}>
          <Header withLangSwitcher />
          {props.children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}