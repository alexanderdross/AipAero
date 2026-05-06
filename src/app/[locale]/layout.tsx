import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-intl/server";
import { localeLangMapping, routing } from "~/i18n/routing";
import Footer from "~/components/footer";
import { Header } from "~/components/header";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { NextIntlClientProvider } from "next-intl";
import { pick } from "lodash";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout(
  props: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }>,
) {
  const { locale } = await props.params;
  const messages = await getMessages();

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <html className="h-full" lang={localeLangMapping[locale]}>
      <body className={"bg-drossgray font-sans"}>
        <Header withLangSwitcher />
        {props.children}
        <NextIntlClientProvider messages={pick(messages, "BreadCrumbs")}>
          <Suspense fallback={null}>
            <BreadCrumbs />
          </Suspense>
        </NextIntlClientProvider>
        <Footer />
        <SpeedInsights />
      </body>
    </html>
  );
}
