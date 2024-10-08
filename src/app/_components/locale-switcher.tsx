"use client";

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Translation } from '~/lib/i18n';
import { orgUrl } from './metadata';

export function LocaleSwitcher({ translation }: { translation: Translation }) {
  // Find current page in translation
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [key, setKey] = useState(translation.LanguageCode === 'en' ? 'english' : 'native');
  const pages = [
    {
      href: translation.CountryPage.href,
      alternate: translation.CountryPage.alternate,
      alternateIetfLang: translation.CountryPage.alternateIetfLang,
    },
    {
      href: translation.VfrPage.href,
      alternate: translation.VfrPage.alternate,
      alternateIetfLang: translation.VfrPage.alternateIetfLang,
    },
    {
      href: translation.IfrPage?.href,
      alternate: translation.IfrPage?.alternate,
      alternateIetfLang: translation.IfrPage?.alternateIetfLang,
    },
    {
      href: translation.HeliportPage.href,
      alternate: translation.HeliportPage.alternate,
      alternateIetfLang: translation.HeliportPage.alternateIetfLang,
    },
    {
      href: translation.AirportsPage.href,
      alternate: translation.AirportsPage.alternate,
      alternateIetfLang: translation.AirportsPage.alternateIetfLang,
    },
  ];

  const currentPage = pages.find(page => page.href && pathname === page.href);
  if (!currentPage || currentPage.href === currentPage.alternate || !currentPage.alternate || !currentPage.href) {
    return <></>;
  }
  if (!translation?.LocaleSwitcher?.native || !translation?.LocaleSwitcher?.english) {
    return <></>;
  }

  const handleSwitch = () => {
    if (key === 'english') {
      setKey('native');
    } else {
      setKey('english');
    }
    if (currentPage.alternate) {
      router.push(currentPage.alternate)
    }
  };

  const icao = Array.from(searchParams.keys()).length === 1 ? `?${Array.from(searchParams.keys())[0]}` : '';
  const webpageSchema = {
    "@context": "https://schema.org/",
    "@type": "WebPage",
    "potentialAction": {
      "@type": "Action",
      "target": [
        new URL(currentPage.href+icao, orgUrl).toString(),
        {
          "@type": "LinkRole",
          "target": new URL(currentPage.href+icao, orgUrl).toString(),
          "inLanguage": translation.LanguageCode,
          "linkRelationship": "alternate"
        },
        {
          "@type": "LinkRole",
          "target": new URL(currentPage.alternate+icao, orgUrl).toString(),
          "inLanguage": currentPage.alternateIetfLang?.split('-')[0] ?? 'en',
          "linkRelationship": "alternate"
        }
      ]
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webpageSchema)
        }}
      />
      <div className='flex justify-center pt-4'>
        <select title="switch language" value={key} onChange={handleSwitch} className='m-0 py-0 pl-2 pr-8'>
          <option value={'native'} title={`switch to ${translation.LocaleSwitcher.native}`} rel="noopener">{translation.LocaleSwitcher.native}</option>
          <option value={'english'} title={`switch to ${translation.LocaleSwitcher.english}`} rel="noopener">{translation.LocaleSwitcher.english}</option>
        </select>
      </div>
    </>
  );
}