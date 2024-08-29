import {useTranslations} from 'next-intl';
import {unstable_setRequestLocale} from 'next-intl/server';
import Link from 'next/link';

type Props = {
  params: {locale: string};
};

export default function IndexPage({params: {locale}}: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const t = useTranslations('IndexPage.native');

  return (
    <>
      <h1>{t('title')}</h1>
      <Link href="/">Home</Link>
      <p className="max-w-[590px]">
        {t.rich('description', {
          code: (chunks) => (
            <code className="font-mono text-white">{chunks}</code>
          )
        })}
      </p>
    </>
  );
}