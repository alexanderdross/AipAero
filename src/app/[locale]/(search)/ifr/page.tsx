import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata, ResolvingMetadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import getConfig from 'next/config';
import { notFound } from 'next/navigation';
import { AboutCountryBox } from '~/components/about-country-box';
import { ExternalLink } from '~/components/external-link';
import { SchemaAirport } from '~/components/schemas/schema-airport';
import { SchemaProduct } from '~/components/schemas/schema-product';
import { SchemaSitenav } from '~/components/schemas/schema-sitenav';
import { SchemaWebsite } from '~/components/schemas/schema-website';
import { SearchInputField } from '~/components/search-input-field';
import { Title } from '~/components/title';
import { getPathname, localeCountryMapping, type Pathnames } from '~/i18n/routing';
import { orgUrl, rootBreadcrumb, rootSiteNav } from '~/lib/utils';
import { QUERIES } from '~/server/db/queries';
import { Airport } from '~/server/db/schema';

// All slugs besides the static ones will be 404
export const dynamicParams = false;

// Only available for Germany
export function generateStaticParams() {
  return [
    { locale: 'de-EN' },
    { locale: 'de' }
  ];
}

export async function generateMetadata({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ locale: string }>; 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>; 
}, 
parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'IfrPage' });
  const previousOpenGraph = (await parent).openGraph ?? {};

  let data: Airport | undefined;
  const country = localeCountryMapping[locale] as string;
  const p = Object.keys((await searchParams));
  if (p.at(0) !== undefined) {
    data = await QUERIES.airport(p.at(0) as string, country, 'ifr');
    if (!data) {
      return notFound();
    }
  }

  return {
    title: data ? `🛩️ ${t('resultTitle', { airport: data.title })}` : t('metaTitle'),
    description: data ? `${t('resultDescription', { airport: data.title })}🗺️` : t('metaDescription'),
    openGraph: {
      ...previousOpenGraph,
      siteName: data ? `🛩️ ${t('resultTitle', { airport: data.title })}` : t('metaTitle'),
    },
  }
}

export default async function IndexPage({
  params,
  searchParams
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}>) {
  const { locale } = await params;
  // Enable static rendering
  setRequestLocale(locale);

  const p = Object.keys((await searchParams));
  const t = await getTranslations('IfrPage');

  let data: Airport | undefined;
  const country = localeCountryMapping[locale] as string;
  if (p.at(0) !== undefined) {
    data = await QUERIES.airport(p.at(0) as string, country, 'ifr');
    if (!data) {
      return notFound();
    }
  }

  const tCountry = await getTranslations('CountryPage');
  let currentUrl = new URL(getPathname({ href: '/ifr', locale }), orgUrl).toString();
  let schemaProductName = t('breadcrumb.alternateName');
  let schemaAlternateName = t('breadcrumb.name');
  let schemaDescription = t('breadcrumb.description');
  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      rootBreadcrumb,
      {
        "@type": "ListItem",
        "position": 2,
        "item": {
          "@id": new URL(getPathname({ href: '/', locale }), orgUrl).toString() + '/',
          "name": tCountry('breadcrumb.name'),
          "alternateName": tCountry('breadcrumb.alternateName'),
          "description": tCountry('breadcrumb.description')
        }
      },
      {
        "@type": "ListItem",
        "position": 3,
        "item": {
          "@id": new URL(getPathname({ href: '/ifr', locale }), orgUrl).toString(),
          "name": t('breadcrumb.name'),
          "alternateName": t('breadcrumb.alternateName'),
          "description": t('breadcrumb.description'),
        }
      },
    ]
  };
  if (data) {
    currentUrl = new URL(getPathname({ href: { pathname: '/ifr', query: { [data.slug]: '' } }, locale }), orgUrl).toString().replace('=', '');
    schemaProductName = t('resultTitle', { airport: data.title });
    schemaAlternateName = data.icao ?? data.title;
    schemaDescription = t('resultDescription', { airport: data.title });
    breadcrumbsSchema.itemListElement.push({
      "@type": "ListItem",
      "position": 4,
      "item": {
        "@id": currentUrl,
        "name": data.icao ?? data.title,
        "alternateName": t('resultTitle', { airport: data.title }),
        "description": t('resultDescription', { airport: data.title })
      }
    });
  }

  const { publicRuntimeConfig } = getConfig() as { publicRuntimeConfig: { modifiedDate: string } };
  const modifiedDate = new Date(publicRuntimeConfig.modifiedDate);

  return (
    <>
      <Title
        title={data ? t('resultTitle', { airport: data.title }) : t('title')}
        description={data ? t('resultDescription', { airport: data.title }) : t('description')}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbsSchema)
        }}
      />
      <SchemaProduct
        name={schemaProductName}
        alternateName={schemaAlternateName}
        description={schemaDescription}
        publishedDate={modifiedDate}
        currentUrl={currentUrl}
      />
      <SchemaWebsite />
      {data && (
        <SchemaAirport
          name={data.title}
          icaoCode={data.icao}
          alternateName={t('resultTitle', { airport: data.title })}
          description={t('resultDescription', { airport: data.title })}
          url={currentUrl}
        />
      )}
      <SchemaSitenav locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SearchInputField
          value={data?.icao ?? undefined}
          title={t('searchTitle')}
          type="ifr"
          country={country}
        />
        <div className="max-w-7xl px-4 sm:px-6 lg:px-8 text-center mt-3 w-full text-white absolute left-1/2 transform -translate-x-1/2">
          <ol>
            {data && (
              <li>
                <ExternalLink
                  href={`${data.url}`}
                  className="bg-drossblue py-2 flex gap-x-2 content-center justify-center hover:bg-drossblue-light"
                  hrefTitle={t('resultTitle', { airport: data.title })}
                >
                  <span>{data.title}</span>
                  <ExternalLinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                </ExternalLink>
              </li>
            )}
          </ol>
        </div>
      </div>

      {/* About AIP Box */}
      <AboutCountryBox isH3={false} />

    </>
  );
}