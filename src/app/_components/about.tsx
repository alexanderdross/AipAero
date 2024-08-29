import { useTranslations } from "next-intl";

export default function About({english}: {english?: boolean}) {
  const t = useTranslations(`About${english ? '.english' : '.native'}`);

  return (
    <section className="bg-green-200 p-4 text-center">
      <h3>{t('title')}</h3>
      <p>{t.rich('description', {
        aip: (chunks) => <a href={t('aipHref')}>{chunks}</a>
      })}</p>
    </section>
  );
}