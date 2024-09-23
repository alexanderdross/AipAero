import { ContentSearchPage } from '~/app/_components/content-search-page';
import { getTranslation } from '~/lib/i18n';

export default function Page({ params }: { params: { locale: string } }) {
  const translation = getTranslation({ tld: params.locale, english: false });
  return ContentSearchPage({ locale: params.locale, translation: translation.VfrPage });
}