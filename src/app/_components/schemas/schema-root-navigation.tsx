'use server'

import { orgUrl } from "~/app/_components/metadata";
import { getTranslations } from "~/lib/i18n";

export async function SchemaRootNavigation() {
  const nativeCountryInfos = await getTranslations({ english: false });
  const englishCountryInfos = await getTranslations({ english: true });
  const englishCountryNames = englishCountryInfos.map(i => i.Country);
  const countriesAsSentence = englishCountryNames.slice(0, -1).join(', ') + ' and ' + englishCountryNames.slice(-1)[0];

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": `AIP approach charts of ${countriesAsSentence}`,
        "alternateName": "AIP:Aero",
        "description": `AIP approach charts VFR, IFR & Heliports of ${countriesAsSentence}`,
        "inLanguage": "en",
        "url": orgUrl.toString()
      },
      ...nativeCountryInfos.map((countryInfo) => ({
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": countryInfo.CountryPage.title,
        "alternateName": `AIP ${countryInfo.Country}`,
        "description": countryInfo.CountryPage.description,
        "inLanguage": countryInfo.LanguageCode,
        "url": new URL(`/${countryInfo.Tld}/`, orgUrl).toString()
      })),
      ...englishCountryInfos.filter(x => !x.isSingleLocale).map((countryInfo) => ({
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": countryInfo.CountryPage.title,
        "alternateName": `AIP ${countryInfo.Country}`,
        "description": countryInfo.CountryPage.description,
        "inLanguage": "en",
        "url": new URL(`/${countryInfo.Tld}/en/`, orgUrl).toString()
      }))
    ]
  };
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />
}