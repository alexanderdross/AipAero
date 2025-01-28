import { useTranslations } from "next-intl";
import { AboutBox } from "~/components/about-box";
import { ExternalLink } from "~/components/external-link";

export function AboutCountryBox() {
  const t = useTranslations('About');

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