import { useTranslations } from 'next-intl';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Header } from '~/app/_components/header';
import Search from '~/app/_components/search';
import { generateMetadata as genMetadata } from "~/lib/generate-metadata";

export async function generateMetadata({
  params: { locale }
}: Omit<Props, 'children'>) {
  const t = await getTranslations({ locale, namespace: 'HeliportPage.english' });
  console.log(t('title'));

  return genMetadata(t('title'), t('subtitle'), `/${locale}/`);
}
type Props = {
  params: { locale: string };
};

export default function IndexPage({ params: { locale } }: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const t = useTranslations('HeliportPage.english');

  return (
    <>
      <Header title={t('title')} subtitle={t('subtitle')} />
      <Search placeholder={t('placeholder')} type="heliport" />
    </>
  );
}