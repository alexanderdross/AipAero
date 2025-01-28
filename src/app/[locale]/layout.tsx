import {notFound} from 'next/navigation';
import {getMessages, getTranslations, setRequestLocale} from 'next-intl/server';
import {routing} from '~/i18n/routing';
import { NextIntlClientProvider } from 'next-intl';
import { cn } from '~/lib/utils';
import { GeistSans } from "geist/font/sans";
import Footer from '~/components/footer';
import { AboutCountryBox } from '~/components/about-country-box';
import { Header } from '~/components/header';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata(props: Readonly<{
  params: Promise<{ locale: string; }>;
}>) {
  const { locale } = await props.params;
  const t = await getTranslations({locale, namespace: 'LocaleLayout'});

  return {
    title: t('title')
  };
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
  const lang = locale === 'at' ? 'de' : locale === 'uk' ? 'en' : locale;

  return (
    <html className="h-full" lang={lang}>
      <body className={cn(GeistSans.className, 'bg-drossgray')}>
        <NextIntlClientProvider messages={messages}>
          <Header withLangSwitcher />
          {props.children}
          <AboutCountryBox />
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}