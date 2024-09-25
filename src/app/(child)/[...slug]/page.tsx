import { notFound } from 'next/navigation';
import { ContentAirportsPage } from '~/app/_components/content-airports-page';
import { ContentCountryPage } from '~/app/_components/content-country-page';
import { ContentSearchPage } from '~/app/_components/content-search-page';
import { getTranslation, type Translation } from '~/lib/i18n';

function lastUrlSegment(url: string) {
  return url.split('/').filter(Boolean).at(-1);
}

export default function Page({ params }: { params: { slug: string[] } }) {
  const countryCode = params.slug.at(0);
  if (!countryCode) {
    return notFound();
  }
  const isEnglish = params.slug.at(1) === "en";

  // Get translation depending on countryCode code and language
  let translation: Translation;
  try {
    translation = getTranslation({ tld: countryCode, english: isEnglish });
  } catch {
    return notFound();
  }

  // Return Country Page if requested
  if (params.slug.length === 1 && !isEnglish || params.slug.length === 2 && isEnglish) {
    return <ContentCountryPage translation={translation} />;
  }

  const slugNeeded = isEnglish ? params.slug.at(2) : params.slug.at(1);
  if (!slugNeeded) {
    return notFound();
  }
  
  if (slugNeeded === lastUrlSegment(translation.VfrPage.href)) {
    return <ContentSearchPage translation={translation.VfrPage} type={'vfr'} />;
  }
  if (translation.IfrPage && slugNeeded === lastUrlSegment(translation.IfrPage?.href)) {
    return <ContentSearchPage translation={translation.IfrPage} type='ifr' />;
  }
  if (slugNeeded === lastUrlSegment(translation.HeliportPage.href)) {
    return <ContentSearchPage translation={translation.HeliportPage} type='heliport' />;
  }
  if (slugNeeded === lastUrlSegment(translation.AirportsPage.href)) {
    return <ContentAirportsPage translation={translation.AirportsPage} />;
  }

  return notFound();
}