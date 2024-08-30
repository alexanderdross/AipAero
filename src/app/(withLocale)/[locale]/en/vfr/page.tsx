import {useTranslations} from 'next-intl';
import {unstable_setRequestLocale} from 'next-intl/server';
import { Header } from '~/app/_components/header';

type Props = {
  params: {locale: string};
};

export default function IndexPage({params: {locale}}: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const t = useTranslations('VfrPage.english');

  return (
    <Header title={t('title')} subtitle={t('subtitle')} />
  );
}