import { LinkIcon } from 'lucide-react';
import type { Metadata, ResolvingMetadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AboutCountryBox } from '~/components/about-country-box';
import { Title } from '~/components/title';
import { getPathname, Link, routing } from '~/i18n/routing';
import { type Airport } from '~/server/db/schema';
import LoadingList from './loading-list';
import { QUERIES } from '~/server/db/queries';
import { i18nPathMapping, orgUrl, rootBreadcrumb } from '~/lib/utils';
import { SchemaProduct } from '~/components/schemas/schema-product';
import getConfig from 'next/config';
import { SchemaSitenav } from '~/components/schemas/schema-sitenav';

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
  const t = await getTranslations({ locale, namespace: 'AirportsPage' });
  const previousOpenGraph = (await parent).openGraph ?? {};

  return {
    title: t('metaTitle'),
    abstract: t('metaDescription'),
    description: t('metaDescription'),
    openGraph: {
      ...previousOpenGraph,
      url: new URL(getPathname({ href: '/airport-list', locale }), orgUrl).toString(),
      siteName: t('metaTitle'),
    },
  }
}

export default async function IndexPage(props: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);
  const t = await getTranslations('AirportsPage');

  const tCountry = await getTranslations('CountryPage');
  const currentUrl = new URL(getPathname({ href: '/airport-list', locale }), orgUrl).toString();
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
          "@id": currentUrl,
          "name": t('breadcrumb.name'),
          "alternateName": t('breadcrumb.alternateName'),
          "description": t('breadcrumb.description'),
        }
      },
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
      <Suspense fallback={<LoadingList />}>
        <AirportLists locale={locale} />
      </Suspense>
      {/* About AIP Box */}
      <AboutCountryBox isH3={false} />
    </>
  );
}

async function AirportLists({ locale }: { locale: string }) {
  const t = await getTranslations('AirportsPage');
  const country = locale.split('-')[0] as string;

  const [vfrAirports, ifrAirports, heliports] = await Promise.all([
    QUERIES.vfrAirports(country),
    QUERIES.ifrAirports(country),
    QUERIES.heliports(country),
  ])

  const i18nKeyMapping: Record<Airport['type'], string> = {
    'vfr': 'vfrCard',
    'ifr': 'ifrCard',
    'heliport': 'heliportCard',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap justify-center gap-6">
        {[vfrAirports, ifrAirports, heliports].filter(x => x.length > 0).map((airports, index) => {
          const airportType = airports[0]?.type as Airport['type'];
          const key = i18nKeyMapping[airportType];
          return (
            <div key={index} className="bg-white py-8 px-6 border border-[#ccc] flex-grow basis-0 min-w-80">
              <h2 className="text-center text-2xl font-normal">{t(`${key}.title`)}</h2>
              <p className="text-center pb-2">{t(`${key}.description`)}</p>
              <ol>
                {airports.map((airport, index) => {
                  return (
                    <li
                      key={index}
                      itemScope
                      itemType="https://schema.org/Airport"
                      className="flex items-center gap-x-4"
                    >
                      <span>{index + 1}.</span>
                      <Link
                        href={{ pathname: i18nPathMapping[airportType], query: airport.slug }}
                        itemProp="url"
                        className="text-drossblue py-2 flex gap-x-2 justify-left hover:underline"
                        title={t(`${key}.linkTitle`, { airport: airport.title })}
                        aria-label={t(`${key}.linkTitle`, { airport: airport.title })}
                        target="_blank"
                        rel="noopener"
                      >
                        <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                        <span itemProp="name">{airport.title}</span>
                      </Link>
                      <meta itemProp="description" content={t(`${key}.linkTitle`, { airport: airport.title })} />
                      {airport.icao && <meta itemProp="icaoCode" content={airport.icao} />}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}