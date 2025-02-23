import type { Metadata, ResolvingMetadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import getConfig from 'next/config';
import { AboutCountryBox } from '~/components/about-country-box';
import { Box } from '~/components/box';
import { SchemaProduct } from '~/components/schemas/schema-product';
import { SchemaSitenav } from '~/components/schemas/schema-sitenav';
import { Title } from '~/components/title';
import { getPathname, routing } from '~/i18n/routing';
import { cn, orgUrl, rootBreadcrumb } from '~/lib/utils';

// All slugs besides the static ones will be 404
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'CountryPage' });
  const previousOpenGraph = (await parent).openGraph ?? {};

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    openGraph: {
      ...previousOpenGraph,
      siteName: t('metaTitle'),
    },
  }
}

export default async function CountryPage(props: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);

  const t = await getTranslations('CountryPage');

  // Only Germany has IFR Card
  const keys = locale.startsWith('de') ?
    ['vfrCard', 'ifrCard', 'heliportCard'] as const
    : ['vfrCard', 'heliportCard'] as const;

  const currentUrl = new URL(getPathname({ href: '/', locale }), orgUrl).toString() + '/'
  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      rootBreadcrumb,
      {
        "@type": "ListItem",
        "position": 2,
        "item": {
          "@id": currentUrl,
          "name": t('breadcrumb.name'),
          "alternateName": t('breadcrumb.alternateName'),
          "description": t('breadcrumb.description')
        }
      }
    ]
  };

  const { publicRuntimeConfig } = getConfig() as { publicRuntimeConfig: { modifiedDate: string } };
  const modifiedDate = new Date(publicRuntimeConfig.modifiedDate);

  return (
    <>
      <Title
        title={t('title')}
        description={t('description')}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbsSchema)
        }}
      />
      <SchemaProduct
        name={t('breadcrumb.alternateName')}
        alternateName={t('breadcrumb.name')}
        description={t('breadcrumb.description')}
        publishedDate={modifiedDate}
        currentUrl={currentUrl}
      />
      <SchemaSitenav locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn("grid gap-6 grid-cols-1 md:grid-cols-2", keys.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {keys.map((key) => (
            <Box
              key={key}
              title={t(`${key}.title`)}
              description={t(`${key}.description`)}
              buttons={[{
                href: t(`${key}.buttonHref`),
                hrefTitle: t(`${key}.buttonHrefTitle`),
                title: t(`${key}.buttonTitle`),
              }]}
            />
          ))}
        </div>
      </div>

      {/* About AIP Box */}
      <AboutCountryBox isH3={true} />
    </>
  );
}