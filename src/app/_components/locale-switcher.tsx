"use client";

import { useLocale, useMessages, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [key, setKey] = useState(pathname.includes('/en/') ? 'english' : 'native');

  const messages = useMessages();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call
  if (!messages?.LocaleSwitcher) {
    return <></>;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const t = useTranslations('LocaleSwitcher');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call
  const keys = Object.keys(messages.LocaleSwitcher);
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
      <select title="switch language" value={key} onChange={handleSwitch}>
        {keys.map((key) => (
          <option key={key} value={key} title={`switch to ${t(key)}`} rel="noopener">{t(key)}</option>
        ))}
      </select>
    </div>
  );
}