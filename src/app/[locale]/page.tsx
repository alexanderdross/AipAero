import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Title } from '~/components/title';

export default async function IndexPage(props: Readonly<{
  params: Promise<{ locale: string; }>;
}>) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);

  const t = await getTranslations('CountryPage');

  return (
    <Title
      title={t('title')}
      description={t('description')}
    />
  );
}