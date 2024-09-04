import {useTranslations} from 'next-intl';
import {unstable_setRequestLocale} from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header } from '~/app/_components/header';

type Props = {
  params: {locale: string; airportList: string};
};

// All slugs besides the static ones will be 404
/*export const dynamicParams = false;

// generateStaticParams will be called at build time, important for sitemap.xml
export function generateStaticParams() {
  const t = useTranslations('AirportsPage.english');
  return [{airportList: t('href').split('/').filter(Boolean).at(-1)}]
}*/

export default function IndexPage({params: {locale, airportList}}: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const t = useTranslations('AirportsPage.english');
  if (t('href').split('/').filter(Boolean).at(-1) !== airportList) {
    return notFound();
  }

  return (
    <>
      <Header title={t('title')} subtitle={t('subtitle')} />
    </>
  );
}