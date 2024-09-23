import { getTranslation } from '~/lib/i18n';
import { ContentCountryPage } from '~/app/_components/content-country-page';

export default function CountryPage({ params }: { params: { locale: string } }) {
  const translation = getTranslation({ tld: params.locale });
  return <ContentCountryPage translation={translation} />;
}