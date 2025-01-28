import {getTranslations, setRequestLocale} from 'next-intl/server';

export default async function PathnamesPage(props: Readonly<{
  params: Promise<{ locale: string; }>;
}>) {
  const { locale } = await props.params;
  // Enable static rendering
  setRequestLocale(locale);

  const t = await getTranslations('PathnamesPage');

  return (
    <div>
      {t('title')}
      <div className="max-w-[490px]">
        {t.rich('description', {
          p: (chunks) => <p className="mt-4">{chunks}</p>,
          code: (chunks) => (
            <code className="font-mono text-white">{chunks}</code>
          )
        })}
      </div>
    </div>
  );
}