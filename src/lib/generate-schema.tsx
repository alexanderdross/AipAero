import { orgLogoSquareUrl, orgLogoUrl, orgUrl } from "~/lib/generate-metadata";
import { getTranslations } from "~/lib/i18n";

const nativeCountryInfos = getTranslations({ english: false });
const englishCountryInfos = getTranslations({ english: true });
const englishCountryNames = englishCountryInfos.map(i => i.Country);
const countriesAsSentence = englishCountryNames.slice(0, -1).join(', ') + ' and ' + englishCountryNames.slice(-1)[0];

export const generateNavigationSchema = (locale?: string, english?: boolean) => {
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

export const generateProductSchema = (name: string, alternateName: string, description: string, href?: string) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "247",
      "reviewCount": "247",
      "bestRating": "5",
      "worstRating": "1"
    },
    "name": name,
    "alternateName": alternateName,
    "description": description,
    "url": href ? (new URL(href, orgUrl)).toString() : orgUrl.toString(),
    "image": [{
      "@type": "ImageObject",
      "url": orgLogoSquareUrl.toString(),
      "width": 450,
      "height": 450
    },
    {
      "@type": "ImageObject",
      "url": orgLogoUrl.toString(),
      "width": 446,
      "height": 319
    }],
    "logo": [{
      "@type": "ImageObject",
      "url": orgLogoSquareUrl.toString(),
      "width": 450,
      "height": 450
    },
    {
      "@type": "ImageObject",
      "url": orgLogoUrl.toString(),
      "width": 446,
      "height": 319
    }],
    "review": {
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": "Alexander Dross",
        "url": "https://dross.net/alexander/"
      },
      "datePublished": "2024-07-19",
      "additionalType": [
        "https://dross.net/alexander/",
        "https://dross.net/media/",
        "https://dross.net/air/",
        "https://dross.net/alexander/blog/",
        "https://dross.net/alexander/feed",
        "https://aip.aero/",
        "https://dross.net/aviation/"
      ],
      "reviewRating": {
        "@type": "Rating",
        "bestRating": "5",
        "ratingValue": "4.9",
        "worstRating": "1"
      }
    }
  };
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />;
}

export const generateAirportSchema = (alternateName: string, description: string) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Airport",
    "alternateName": alternateName,
    "description": description
  };
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }}
  />;
}