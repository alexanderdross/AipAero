import type { Metadata, ResolvingMetadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type React from "react";
import Footer from "~/components/footer";
import { Header } from "~/components/header";
import { SchemaDedupe } from "~/components/schema-dedupe";
import { Title } from "~/components/title";
import { inter } from "~/lib/fonts";
import { serpTitle } from "~/lib/utils";

/** The other-language version of a legal page (the language-toggle target). */
export type AltLink = {
  /** Absolute path of the counterpart page (e.g. "/impressum/"). */
  href: string;
  /** Link text, in the target language (e.g. "Deutsch", "English"). */
  label: string;
  /** BCP-47 code of the target ("de" / "en"). */
  hrefLang: string;
  /** SEO/discovery title attribute. */
  title: string;
};

/**
 * Shared metadata for the paired single-language legal pages. Spreads the
 * parent (root layout) openGraph so the site's default OG images + type survive
 * - a page that sets its own `openGraph` object otherwise REPLACES the parent's,
 * dropping og:image (the e2e SEO contract requires it). Emits `hreflang`
 * alternates for the English/German pair (x-default -> English). The SERP
 * <title> gets the emoji decoration; og:site_name stays the plain title.
 */
export async function legalMetadata(
  parent: ResolvingMetadata,
  opts: {
    title: string;
    description: string;
    canonical: string;
    lang: "en" | "de";
    enHref: string;
    deHref: string;
  },
): Promise<Metadata> {
  const previousOpenGraph = (await parent).openGraph ?? {};
  return {
    title: serpTitle(opts.title),
    description: opts.description,
    alternates: {
      canonical: opts.canonical,
      languages: {
        en: opts.enHref,
        de: opts.deHref,
        "x-default": opts.enHref,
      },
    },
    openGraph: {
      ...previousOpenGraph,
      url: opts.canonical,
      siteName: opts.title,
      locale: opts.lang === "de" ? "de_DE" : "en_GB",
    },
  };
}

/**
 * Full-document shell for the root-level legal pages. These live OUTSIDE
 * `[locale]` - like the global homepage (`src/app/page.tsx`) they render their
 * own `<html>`/`<body>` with the header and the global footer, because the root
 * layout only passes children through.
 *
 * Each topic is TWO single-language pages paired by `hreflang` (owner decision,
 * 18.07.2026): /imprint + /impressum, /privacy + /datenschutz, /terms + /agb.
 * The `lang` prop drives `<html lang>` AND the site chrome locale (English pages
 * pin "uk", German pages "de" - so a German legal page gets a German header /
 * footer). Pinning the locale via setRequestLocale also keeps the page STATIC
 * (otherwise next-intl falls back to `headers()` -> dynamic render, and on
 * Workers only prerendered pages reliably carry their <head> metadata).
 */
export function LegalShell({
  lang,
  title,
  intro,
  altLink,
  jsonLd,
  children,
}: Readonly<{
  lang: "en" | "de";
  title: string;
  intro: string;
  altLink: AltLink;
  /** Optional JSON-LD (e.g. a BreadcrumbList) rendered inside <main>. */
  jsonLd?: React.ReactNode;
  children: React.ReactNode;
}>) {
  setRequestLocale(lang === "de" ? "de" : "uk");
  return (
    <html className={`h-full scroll-smooth ${inter.variable}`} lang={lang}>
      <body className="bg-drossgray font-sans">
        <Header />
        <main className="min-h-screen">
          {jsonLd}
          <Title title={title} description={intro} />
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            {/* Language toggle to the counterpart page (crawlable, hreflang). */}
            <p className="text-right">
              <a
                href={altLink.href}
                hrefLang={altLink.hrefLang}
                lang={altLink.hrefLang}
                title={altLink.title}
                className="text-drossblue inline-flex min-h-10 items-center text-sm font-medium hover:underline"
              >
                {altLink.label}
              </a>
            </p>
            <div className="border-drossgray-dark/15 mt-2 flex flex-col gap-8 rounded-xl border bg-white p-6 pb-8 shadow-sm sm:p-8">
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
