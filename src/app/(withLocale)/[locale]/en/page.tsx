import {useTranslations} from 'next-intl';
import {unstable_setRequestLocale} from 'next-intl/server';

type Props = {
  params: {locale: string};
};

export default function IndexPage({params: {locale}}: Props) {
  const englishLocale = locale + '/en';
  // Enable static rendering
  unstable_setRequestLocale(englishLocale);

  const t = useTranslations('IndexPage');

  return (
    <>
      <h1>{t('title')}</h1>
      <p className="max-w-[590px]">
        {t('description')}
        {t.rich('description', {
          code: (chunks) => (
            <code className="font-mono text-white">{chunks}</code>
          )
        })}
      </p>
    </>
  );
}