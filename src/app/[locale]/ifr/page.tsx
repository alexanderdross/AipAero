import type { Metadata, ResolvingMetadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AboutCountryBox } from '~/components/about-country-box';
import { Title } from '~/components/title';

// All slugs besides the static ones will be 404
export const dynamicParams = false;

// Only available for Germany
export function generateStaticParams() {
  return [
    { locale: 'de-EN' },
    { locale: 'de' }
  ];
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({locale, namespace: 'IfrPage'});
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

export default async function IndexPage(props: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);

  const t = await getTranslations('IfrPage');

  return (
    <>
      <Title
        title={t('title')}
        description={t('description')}
      />

      {/* About AIP Box */}
      <AboutCountryBox isH3={false} />

    </>
  );
}