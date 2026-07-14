import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { localeLangMapping, routing } from "~/i18n/routing";
import Footer from "~/components/footer";
import { Header } from "~/components/header";
import { SchemaWebsite } from "~/components/schemas/schema-website";
import { SchemaSitenav } from "~/components/schemas/schema-sitenav";
import { SchemaDedupe } from "~/components/schema-dedupe";
import { ServiceWorkerRegistration } from "~/components/service-worker-registration";
import { inter } from "~/lib/fonts";

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

  return (
    <html
      className={`h-full scroll-smooth ${inter.variable}`}
      lang={localeLangMapping[locale]}
    >
      <body className={"bg-drossgray font-sans"}>
        {/* Site-wide JSON-LD lives in the layout (not the individual pages) so
            it renders once. These are SYNCHRONOUS server components, so they
            are rendered DIRECTLY (no Suspense): a Suspense boundary here made
            OpenNext stream the schema as a late chunk that client hydration
            re-inserted as a second <script> in the rendered DOM (the validator
            showed WebSite/SearchAction twice, owner-reported 14.07.2026), and
            SchemaDedupe's timed pass could miss that late insertion. Rendered
            inline they hydrate in place, once. SchemaDedupe (below) still runs,
            now with a MutationObserver, as the belt for the page-emitted nodes
            (BreadcrumbList/Product) that OpenNext can still double. */}
        <SchemaWebsite />
        <SchemaSitenav locale={locale} />
        <Header withLangSwitcher />
        {/* min-h-screen: the footer must START below the initial viewport on
            every page. The dynamic search/detail routes stream the page into
            this layout shell, and their loading state (LoadingSub, ~230px) is
            far shorter than the real content - so on a slow stream the first
            paint showed header + skeleton + FOOTER (at ~y380), and the
            arriving content then pushed the footer ~1500px down: a single
            ~0.36 CLS event attributed to the footer (reproduced locally with
            a delayed gadget stream; the live EDDF/LFPG 0.36-0.39 outliers).
            With main reserving a viewport height, the footer sits below the
            fold before AND after the stream, so the swap cannot shift any
            viewport-visible content. Short pages just gain some background
            whitespace above the fold - the standard sticky-footer trade. */}
        {/* The breadcrumb bar is rendered by each PAGE at the end of its
            content (server-rendered, ~/components/breadcrumbs.tsx) - the
            former layout-level client breadcrumb (and its height reserve)
            is gone. */}
        <main className="min-h-screen">{props.children}</main>
        <Footer />
        {/* Offline PWA: registers /sw.js after load (production hosts only). */}
        <ServiceWorkerRegistration />
        {/* Merge byte-identical duplicate JSON-LD nodes (Workers serving-path
            artifact - see the component's doc comment). */}
        <SchemaDedupe />
      </body>
    </html>
  );
}
