"use client";

import { useTranslations } from "next-intl";
import { Link as IntLink, usePathname } from "~/i18n/routing";
import { cn } from "~/lib/utils";

export function Menu() {
  const t = useTranslations("Menu");
  const pathname = usePathname();
  const items = [
    { href: "/" as const, key: "home" },
    { href: "/vfr" as const, key: "vfr" },
    { href: "/ifr" as const, key: "ifr" },
    { href: "/heliports" as const, key: "heliports" },
    { href: "/airport-list" as const, key: "airports" },
    { href: "/aeroports" as const, key: "aeroports" },
    { href: "/military" as const, key: "military" },
  ];

  return (
    <nav className="hidden items-center gap-4 text-sm lg:flex xl:gap-6">
      {items.map(
        (item) =>
          t.has(`${item.key}.title`) && (
            <IntLink
              title={t(`${item.key}.hrefTitle`)}
              key={item.key}
              className={cn(
                "text-lg text-foreground/80 transition-colors hover:underline",
                pathname === item.href && "underline",
              )}
              href={item.href}
            >
              {t(`${item.key}.title`)}
            </IntLink>
          ),
      )}
    </nav>
  );
}
