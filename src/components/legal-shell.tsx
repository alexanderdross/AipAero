import { setRequestLocale } from "next-intl/server";
import type React from "react";
import Footer from "~/components/footer";
import { Header } from "~/components/header";
import { SchemaDedupe } from "~/components/schema-dedupe";
import { Title } from "~/components/title";
import { inter } from "~/lib/fonts";

/**
 * Full-document shell for the root-level legal pages (`/terms`, `/imprint`,
 * `/privacy`). These live OUTSIDE `[locale]` - like the global homepage
 * (`src/app/page.tsx`) they render their own `<html>`/`<body>` with the header
 * and the global footer, because the root layout only passes children through.
 *
 * The pages are deliberately bilingual (English primary, German below) rather
 * than localized into all 60+ site locales: they are legal/compliance pages,
 * not SEO landing pages, so one canonical page per topic - reachable at a clean
 * root URL - is the right shape (owner decision, 18.07.2026). `<html lang>` is
 * English (the site default); the German block carries its own `lang="de"`.
 */
export function LegalShell({
  title,
  intro,
  jsonLd,
  children,
}: Readonly<{
  title: string;
  intro: string;
  /** Optional JSON-LD (e.g. a BreadcrumbList) rendered inside <main>. */
  jsonLd?: React.ReactNode;
  children: React.ReactNode;
}>) {
  // Header + Footer read next-intl translations; without a set locale next-intl
  // falls back to `headers()` and opts the whole route into DYNAMIC rendering.
  // On Workers, prerendered pages are what reliably carry their <head> metadata
  // and get seeded into the cache - so pin the locale to keep these pages STATIC
  // (the same reason the homepage calls setRequestLocale). See CLAUDE.md.
  setRequestLocale("uk");
  return (
    <html className={`h-full scroll-smooth ${inter.variable}`} lang="en">
      <body className="bg-drossgray font-sans">
        <Header />
        <main className="min-h-screen">
          {jsonLd}
          <Title title={title} description={intro} />
          <div className="mx-auto mt-12 max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="border-drossgray-dark/15 flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
              {children}
            </div>
          </div>
        </main>
        <Footer global />
        {/* Belt-and-braces JSON-LD de-dupe (Workers serving-path artifact). */}
        <SchemaDedupe />
      </body>
    </html>
  );
}

/**
 * A minimal BreadcrumbList (Home > this page) for the root legal pages. They
 * are not in `routing.pathnames`, so the shared `BreadCrumbs` component (which
 * resolves crumbs from the i18n routing) does not apply - this emits the schema
 * directly from the page's own title + URL.
 */
export function LegalBreadcrumbJsonLd({
  name,
  url,
}: Readonly<{ name: string; url: string }>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "AIP:Aero",
              item: "https://aip.aero/",
            },
            { "@type": "ListItem", position: 2, name, item: url },
          ],
        }),
      }}
    />
  );
}
