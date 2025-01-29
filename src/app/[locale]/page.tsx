import type { Metadata, ResolvingMetadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Box } from '~/components/box';
import { Title } from '~/components/title';
import { routing } from '~/i18n/routing';
import { cn } from '~/lib/utils';

// All slugs besides the static ones will be 404
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({locale, namespace: 'CountryPage'});
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

  const t = await getTranslations('CountryPage');

  // Only Germany has IFR Card
  const keys = locale.startsWith('de') ?
    ['vfrCard', 'ifrCard', 'heliportCard'] as const
    : ['vfrCard', 'heliportCard'] as const;

  return (
    <>
      <Title
        title={t('title')}
        description={t('description')}
      />

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
    </>
  );
}