"use client";

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('LocaleSwitcher');
  const currentLocaleSlug = pathname.includes('/en/') ? 'en' : locale;
  const currentLocale = currentLocaleSlug === 'en' ? t('english') : t('native');
  const nextLocale = currentLocaleSlug === 'en' ? t('native') : t('english');
  const nextLocaleHref = currentLocaleSlug === 'en' ? ".." : 'en/';
  return (
    <>
      <select title="switch language" onChange={() => router.push(nextLocaleHref)}>
        <option value={currentLocale} title={`switch to ${currentLocale}`} rel="noopener">{currentLocale}</option>
        <option value={nextLocale} title={`switch to ${nextLocale}`} rel="noopener">{nextLocale}</option>
      </select>
    </>
  );
}