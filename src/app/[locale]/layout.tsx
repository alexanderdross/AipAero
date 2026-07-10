import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-intl/server";
import { localeLangMapping, routing } from "~/i18n/routing";
import Footer from "~/components/footer";
import { Header } from "~/components/header";
import { BreadCrumbs } from "~/components/breadcrumbs";
import { SchemaWebsite } from "~/components/schemas/schema-website";
import { SchemaSitenav } from "~/components/schemas/schema-sitenav";
import { inter } from "~/lib/fonts";
import { NextIntlClientProvider } from "next-intl";
import pick from "lodash/pick";
import { Suspense } from "react";

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

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Enable static rendering. This MUST run before any getMessages()/
  // getTranslations() call - otherwise next-intl falls back to reading
  // headers(), which opts the whole route into dynamic rendering and stops
  // the page (and its generateMetadata output) from being prerendered.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      className={`h-full ${inter.variable}`}
      lang={localeLangMapping[locale]}
    >
      <body className={"bg-drossgray font-sans"}>
        {/* Site-wide JSON-LD lives in the layout (not the individual pages) so
            it renders exactly once. On the dynamic search pages, schemas emitted
            directly by the page were duplicated by the Cloudflare/OpenNext
            render, while schemas rendered from the layout inside a Suspense
            boundary (like the locale-switcher's WebPage, and the airport
            gadgets' Airport node) appear once - so WebSite + SiteNavigation are
            rendered here, inside a Suspense boundary, to match that pattern. */}
        <Suspense fallback={null}>
          <SchemaWebsite />
          <SchemaSitenav locale={locale} />
        </Suspense>
        <Header withLangSwitcher />
        <main>{props.children}</main>
        {/* Reserve the breadcrumb bar's height so it never shifts the footer
            when it renders (it reads searchParams, so it resolves after the
            Suspense boundary). Fixes the ~0.11 CLS Lighthouse flagged. */}
        <div className="min-h-[5.5rem]">
          <NextIntlClientProvider messages={pick(messages, "BreadCrumbs")}>
            <Suspense fallback={null}>
              <BreadCrumbs />
            </Suspense>
          </NextIntlClientProvider>
        </div>
        <Footer />
      </body>
    </html>
  );
}
