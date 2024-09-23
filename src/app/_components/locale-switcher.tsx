"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Translation } from '~/lib/i18n';

export function LocaleSwitcher({ translation, locale }: { translation: Translation["LocaleSwitcher"], locale: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [key, setKey] = useState(pathname.includes('/en/') ? 'english' : 'native');

  if (!translation?.native || !translation?.english) {
    return <></>;
  }

  const handleSwitch = () => {
    if (key === 'english') {
      setKey('native');
      router.push(pathname.replace('/en/', '/'));
    } else {
      setKey('english');
      router.push(pathname.replace(`/${locale}/`, `/${locale}/en/`));
    }
  };

  return (
    <div className='flex justify-center pt-4'>
      <select title="switch language" value={key} onChange={handleSwitch} className='m-0 py-0 pl-2 pr-8'>
        <option value={'native'} title={`switch to ${translation.native}`} rel="noopener">{translation.native}</option>
        <option value={'english'} title={`switch to ${translation.english}`} rel="noopener">{translation.english}</option>
      </select>
    </div>
  );
}