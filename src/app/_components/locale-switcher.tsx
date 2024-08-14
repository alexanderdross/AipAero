"use client";

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';

export function LocaleSwitcher() {
  const pathname = usePathname();
  const locale = useLocale();
  const currentLocale = pathname.includes('/en/') ? 'en' : locale;
  const nextLocale = currentLocale === 'en' ? locale : 'en';
  return (
    <>
      <p>Current Locale {currentLocale} </p>
      <p>Next Locale {nextLocale} </p>
    </>
  );
}