"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Translation } from '~/lib/i18n';

export function LocaleSwitcher({ translation }: { translation: Translation }) {
  // Find current page in translation
  const pathname = usePathname();
  const pages = [
    {
      href: translation.CountryPage.href,
      alternate: translation.CountryPage.alternate,
    },
    {
      href: translation.VfrPage.href,
      alternate: translation.VfrPage.alternate,
    },
    {
      href: translation.IfrPage?.href,
      alternate: translation.IfrPage?.alternate,
    },
    {
      href: translation.HeliportPage.href,
      alternate: translation.HeliportPage.alternate,
    },
    {
      href: translation.AirportsPage.href,
      alternate: translation.AirportsPage.alternate,
    },
  ];

  const currentPage = pages.find(page => page.href && pathname === page.href);
  if (!currentPage || currentPage.href === currentPage.alternate) {
    return <></>;
  }
  if (!translation?.LocaleSwitcher?.native || !translation?.LocaleSwitcher?.english) {
    return <></>;
  }

  const router = useRouter();
  const [key, setKey] = useState(translation.LanguageCode === 'en' ? 'english' : 'native');

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

  return (
    <div className='flex justify-center pt-4'>
      <select title="switch language" value={key} onChange={handleSwitch} className='m-0 py-0 pl-2 pr-8'>
        <option value={'native'} title={`switch to ${translation.LocaleSwitcher.native}`} rel="noopener">{translation.LocaleSwitcher.native}</option>
        <option value={'english'} title={`switch to ${translation.LocaleSwitcher.english}`} rel="noopener">{translation.LocaleSwitcher.english}</option>
      </select>
    </div>
  );
}