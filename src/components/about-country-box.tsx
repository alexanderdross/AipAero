import { getTranslations } from "next-intl/server";
import { AboutBox } from "~/components/about-box";
import { ExternalLink } from "~/components/external-link";

export async function AboutCountryBox() {
  const t = await getTranslations('About');

  return (
    <AboutBox title={t('title')}>
      {t.rich('description', {
        aip: (chunks) => <ExternalLink
          className="text-drossblue hover:underline"
          href={t('aipUrl')}
          hrefTitle={t('aipTitle')}
        >
          {chunks}
        </ExternalLink>
      })}
    </AboutBox>
  );
}