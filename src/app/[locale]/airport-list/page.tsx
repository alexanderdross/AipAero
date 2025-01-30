import { asc, eq } from 'drizzle-orm';
import { LinkIcon } from 'lucide-react';
import type { Metadata, ResolvingMetadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AboutCountryBox } from '~/components/about-country-box';
import { Title } from '~/components/title';
import { Link, routing } from '~/i18n/routing';
import { db } from '~/server/db';
import { type Airport, airports } from '~/server/db/schema';

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
    description: t('metaDescription'),
    openGraph: {
      ...previousOpenGraph,
      siteName: t('metaTitle'),
    },
  }
}

async function AirportLists({ locale }: { locale: string }) {
  const country = locale.split('-')[0] as string;
  const data = await db.query.airports.findMany({
    where: eq(airports.country, country),
    orderBy: [asc(airports.title)],
  });

  const vfrAirports = data.filter((airport) => airport.type === "vfr");
  const ifrAirports = data.filter((airport) => airport.type === "ifr");
  const heliports = data.filter((airport) => airport.type === "heliport");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap justify-center gap-6">
        {vfrAirports.length > 0 && <AirportList
          internalBaseHref={'/vfr'}
          airports={vfrAirports}
        />}
        {ifrAirports.length > 0 && <AirportList
          internalBaseHref={'/ifr'}
          airports={ifrAirports}
        />}
        {heliports.length > 0 && <AirportList
          internalBaseHref={'/heliports'}
          airports={heliports}
        />}
      </div>
    </div>
  );
}

export default async function IndexPage(props: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);
  const t = await getTranslations('AirportsPage');

  return (
    <>
      <Title
        title={t('title')}
        description={t('description')}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <AirportLists locale={locale} />
      </Suspense>
      {/* About AIP Box */}
      <AboutCountryBox isH3={false} />
    </>
  );
}

async function AirportList({
  internalBaseHref,
  airports
}: {
  internalBaseHref: '/vfr' | '/ifr' | '/heliports';
  airports: Airport[];
}) {
  const t = await getTranslations('AirportsPage');

  return <>
    {airports.length > 0 && (<div className="bg-white py-8 px-6 border border-[#ccc] flex-grow basis-0 min-w-80">
      <h2 className="text-center text-2xl font-normal">{t('vfrCard.title')}</h2>
      <p className="text-center pb-2">{t('vfrCard.description')}</p>
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
                href={{ pathname: internalBaseHref, query: { slug: airport.slug } }}
                itemProp="url"
                className="text-drossblue py-2 flex gap-x-2 justify-left hover:underline"
                title={t('vfrCard.linkTitle', { airport: airport.title })}
                aria-label={t('vfrCard.linkTitle', { airport: airport.title })}
                target="_blank"
                rel="noopener"
              >
                <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                <span itemProp="name">{airport.title}</span>
              </Link>
              <meta itemProp="description" content={t('vfrCard.linkTitle', { airport: airport.title })} />
              {airport.icao && <meta itemProp="icaoCode" content={airport.icao} />}
            </li>
          );
        })}
      </ol>
    </div>)}
  </>;
}