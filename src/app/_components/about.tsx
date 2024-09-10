import { useTranslations } from "next-intl";

export default function About({ english }: { english?: boolean }) {
  const t = useTranslations(`About${english ? '.english' : '.native'}`);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-center items-center text-center mt-16">
        <div className="border border-[#ccc] p-4">
          <h3 className="!text-[1.125rem] font-medium">{t('title')}</h3>
          <p>{t.rich('description', {
            aip: (chunks) => <a 
            className="text-drossblue hover:underline" 
            href={t('aipHref')} 
            target="_self" 
            rel="noopener"
            >
              {chunks}
            </a>
          })}</p>
        </div>
      </div>
    </section>
  );
}