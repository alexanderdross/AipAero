'use client';

import { useTranslations } from "next-intl";
import { Link as IntLink, usePathname } from '~/i18n/routing';
import { cn } from "~/lib/utils";

export function Menu() {
  const t = useTranslations('Header');
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 text-sm xl:gap-6">
      <IntLink className={cn("transition-colors hover:underline text-foreground/80", pathname === '/' && "underline")} href="/">{t('home.title')}</IntLink>
      <IntLink className={cn("transition-colors hover:underline text-foreground", pathname === '/vfr' && "underline")} href="/vfr">{t('vfr.title')}</IntLink>
      {t.has('ifr.title') && <IntLink className={cn("transition-colors hover:underline text-foreground", pathname === '/ifr' && "underline")} href="/ifr">{t('ifr.title')}</IntLink>}
      <IntLink className={cn("transition-colors hover:underline text-foreground/80", pathname === '/heliports' && "underline")} href="/heliports">{t('heliports.title')}</IntLink>
      <IntLink className={cn("transition-colors hover:underline text-foreground/80", pathname === '/airport-list' && "underline")} href="/airport-list">{t('airports.title')}</IntLink>
    </nav>
  );
}