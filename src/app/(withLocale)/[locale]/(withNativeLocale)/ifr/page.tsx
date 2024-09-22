import {useTranslations} from 'next-intl';
import {getTranslations, unstable_setRequestLocale} from 'next-intl/server';
import { Header } from '~/app/_components/header';
import Search from '~/app/_components/search';
import { generateMetadata as genMetadata } from "~/lib/generate-metadata";

export async function generateMetadata({
  params: { locale }
}: Omit<Props, 'children'>) {
  const t = await getTranslations({ locale, namespace: 'IfrPage.native' });

  return genMetadata(t('title'), t('description'), `/${locale}/`);
}

type Props = {
  params: {locale: string};
};

export default function CountryPage({params: {locale}}: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const t = useTranslations('IfrPage.native');

  return (
    <>
      <Header title={t('title')} description={t('description')} />
      <Search placeholder={t('placeholder')} type='ifr' />
    </>
  );
}