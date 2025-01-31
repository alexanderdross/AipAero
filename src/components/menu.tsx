'use client';

import { useTranslations } from "next-intl";
import { Link as IntLink, usePathname } from '~/i18n/routing';
import { cn } from "~/lib/utils";

export function Menu() {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const items = [
    { href: '/' as const, key: 'home.title' },
    { href: '/vfr' as const, key: 'vfr.title' },
    { href: '/ifr' as const, key: 'ifr.title' },
    { href: '/heliports' as const, key: 'heliports.title' },
    { href: '/airport-list' as const, key: 'airports.title' },
  ];

  return (
    <nav className="flex items-center gap-4 text-sm xl:gap-6">
      {items.map((item) => (
        t.has(item.key) && <IntLink
          key={item.key}
          className={cn("transition-colors hover:underline text-foreground/80", pathname === item.href && "underline")}
          href={item.href}>
          {t(item.key)}
        </IntLink>
      ))}
    </nav>
  );
}