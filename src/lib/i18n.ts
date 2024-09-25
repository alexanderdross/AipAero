/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/dot-notation,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call */
import fs from 'fs';
import path from 'path';

const messagesDirectory = path.join(process.cwd(), '/messages');

/**
 * Reads a i18n key and returns the value. The key is a dot-separated string, without specifying the language.
 * @param key dot-separated string
 * @param english if true, use the English language, otherwise use the native language
 * @param data the data JSON object
 * @returns the value of the key in the specified language (string)
 */
function getValue(key: string, english: boolean, data: any) {
  let value = data;  // Create a copy of data
  const keys = key.split('.');
  keys.splice(1, 0, english ? 'english' : 'native'); // Insert 'english' or 'native' after the first key
  for (const k of keys) {
    if (!value) {
      break;
    }
    value = value[k];
  }
  if (!value) {
    keys[1] = 'native';
    value = data;
    for (const k of keys) {
      if (!value) {
        return undefined;
      }
      value = value[k];
    }
  }
  return value;
}

function isSingleLocale(data: any) {
  try {
    return !data['Country']['english'];
  }
  catch (e) {
    return false;
  }
}

export interface Translation extends CountryTranslation {
  Footer: LinkTranslation[];
  CountryPage: PageTranslation;
  IfrPage?: SearchPageTranslation;
  VfrPage: SearchPageTranslation;
  HeliportPage: SearchPageTranslation;
  AirportsPage: PageTranslation & {
    VfrAirportsTitle: string,
    VfrAirportsDescription: string,
    IfrAirportsTitle: string,
    IfrAirportsDescription: string,
    HeliportAirportsTitle: string,
    HeliportAirportsDescription: string
  };
  LocaleSwitcher: {
    native: string;
    english: string;
  };
  About: {
    title: string;
    description: string;
    aipHref: string;
    aipHrefTitle: string;
  };
}

export interface CountryTranslation {
  Country: string;
  CountryCode: string;
  Language: string;
  LanguageCode: string;
  Tld: string;
  isSingleLocale: boolean;
}

export interface LinkTranslation {
  title: string;
  href: string;
  hrefTitle: string;
}

export interface PageTranslation extends LinkTranslation, CountryTranslation {
  description: string;
  breadcrumbTitle: string;
  menuTitle: string;
}

export interface SearchPageTranslation extends PageTranslation, CountryTranslation {
  searchPlaceholder: string;
  searchResultHrefTitle: string;
  searchResultEmpty: string;
}

/**
 * Get countryCode information from the messages directory.
 * @param tld - Filter a countryCode: top-level domain of the countryCode.
 * @param english - Whether to use the English or native language.
 * @returns The countryCode information.
 */
export function getTranslations({ tld, english = true }: { tld?: string, english?: boolean }) {
  // Get file names under /messages
  const messages = fs.readdirSync(messagesDirectory)
    .filter((file) => tld ? file.endsWith(`${tld}.json`) : file.endsWith('.json'))
    .map((message) => {
      const fullPath = path.join(messagesDirectory, message);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(fileContents);

      const countryTranslation = {
        Country: getValue('Country', english, data),
        CountryCode: getValue('CountryCode', english, data),
        Language: getValue('Language', english, data),
        LanguageCode: getValue('LanguageCode', english, data),
        Tld: getValue('Tld', english, data),
        isSingleLocale: isSingleLocale(data),
      }

      return {
        ...countryTranslation,
        Footer: getValue('Footer', english, data).map((footer: any) => {
          return {
            title: footer.title,
            href: footer.href,
            hrefTitle: footer.hrefTitle,
          };
        }),
        CountryPage: {
          ...countryTranslation,
          title: getValue('CountryPage.title', english, data),
          description: getValue('CountryPage.description', english, data),
          href: getValue('CountryPage.href', english, data),
          hrefTitle: getValue('CountryPage.hrefTitle', english, data),
          breadcrumbTitle: getValue('CountryPage.breadcrumbTitle', english, data),
          menuTitle: getValue('CountryPage.menuTitle', english, data),
        },
        IfrPage: getValue('IfrPage.title', english, data) ? {
          ...countryTranslation,
          title: getValue('IfrPage.title', english, data),
          description: getValue('IfrPage.description', english, data),
          href: getValue('IfrPage.href', english, data),
          hrefTitle: getValue('IfrPage.hrefTitle', english, data),
          breadcrumbTitle: getValue('IfrPage.breadcrumbTitle', english, data),
          menuTitle: getValue('IfrPage.menuTitle', english, data),
          searchPlaceholder: getValue('IfrPage.searchPlaceholder', english, data),
          searchResultHrefTitle: getValue('IfrPage.searchResultHrefTitle', english, data),
          searchResultEmpty: getValue('IfrPage.searchResultEmpty', english, data),
        } : undefined,
        VfrPage: {
          ...countryTranslation,
          title: getValue('VfrPage.title', english, data),
          description: getValue('VfrPage.description', english, data),
          href: getValue('VfrPage.href', english, data),
          hrefTitle: getValue('VfrPage.hrefTitle', english, data),
          breadcrumbTitle: getValue('VfrPage.breadcrumbTitle', english, data),
          menuTitle: getValue('VfrPage.menuTitle', english, data),
          searchPlaceholder: getValue('VfrPage.searchPlaceholder', english, data),
          searchResultHrefTitle: getValue('VfrPage.searchResultHrefTitle', english, data),
          searchResultEmpty: getValue('VfrPage.searchResultEmpty', english, data),
        },
        HeliportPage: {
          ...countryTranslation,
          title: getValue('HeliportPage.title', english, data),
          description: getValue('HeliportPage.description', english, data),
          href: getValue('HeliportPage.href', english, data),
          hrefTitle: getValue('HeliportPage.hrefTitle', english, data),
          breadcrumbTitle: getValue('HeliportPage.breadcrumbTitle', english, data),
          menuTitle: getValue('HeliportPage.menuTitle', english, data),
          searchPlaceholder: getValue('HeliportPage.searchPlaceholder', english, data),
          searchResultHrefTitle: getValue('HeliportPage.searchResultHrefTitle', english, data),
          searchResultEmpty: getValue('HeliportPage.searchResultEmpty', english, data),
        },
        AirportsPage: {
          ...countryTranslation,
          title: getValue('AirportsPage.title', english, data),
          description: getValue('AirportsPage.description', english, data),
          href: getValue('AirportsPage.href', english, data),
          hrefTitle: getValue('AirportsPage.hrefTitle', english, data),
          breadcrumbTitle: getValue('AirportsPage.breadcrumbTitle', english, data),
          menuTitle: getValue('AirportsPage.menuTitle', english, data),
          VfrAirportsTitle: getValue('AirportsPage.VfrAirportsTitle', english, data),
          VfrAirportsDescription: getValue('AirportsPage.VfrAirportsDescription', english, data),
          IfrAirportsTitle: getValue('AirportsPage.IfrAirportsTitle', english, data),
          IfrAirportsDescription: getValue('AirportsPage.IfrAirportsDescription', english, data),
          HeliportAirportsTitle: getValue('AirportsPage.HeliportAirportsTitle', english, data),
          HeliportAirportsDescription: getValue('AirportsPage.HeliportAirportsDescription', english, data),
        },
        LocaleSwitcher: {
          native: getValue('LocaleSwitcher', false, data),
          english: getValue('LocaleSwitcher', true, data),
        },
        About: {
          title: getValue('About.title', english, data),
          description: getValue('About.description', english, data),
          aipHref: getValue('About.aipHref', english, data),
          aipHrefTitle: getValue('About.aipHrefTitle', english, data),
        },
      } as Translation;
    }).sort((a, b) => a.Country.localeCompare(b.Country));

  if (!messages) {
    throw new Error(`No messages found for ${tld}`);
  }
  return messages;
}

/**
 * Get countryCode information from the messages directory.
 * @param tld - Filter a countryCode: top-level domain of the countryCode.
 * @param english - Whether to use the English or native language.
 * @returns The countryCode information.
 */
export function getTranslation({ tld, english = true }: { tld: string, english?: boolean }) {
  const translation = getTranslations({ tld, english });
  if (translation.length === 0 || !translation[0]) {
    throw new Error(`No translation found for ${tld}`);
  }
  return translation[0];
}