import { getTranslation } from '~/lib/i18n';
import { ContentCountryPage } from '~/app/_components/content-country-page';

type Props = {
  params: { locale: string };
};

export default function CountryPage({ params: { locale } }: Props) {
  const translation = getTranslation({ tld: locale, english: false });
  return <ContentCountryPage translation={translation} />;
}