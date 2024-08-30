"use client";

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function LocaleSwitcher() {
  const pathname = usePathname();
  const locale = useLocale();
  const currentLocale = pathname.includes('/en/') ? 'en' : locale;
  const nextLocale = currentLocale === 'en' ? locale : 'en';
  const nextLocaleHref = currentLocale === 'en' ? ".." : 'en/';
  return (
    <>
      <p>Current Locale {currentLocale} </p>
      <Link href={nextLocaleHref} title={`switch to ${nextLocale}`} className='text-drossblue hover:underline'>Next Locale {nextLocale} </Link>
    </>
  );
}