import { getTranslations } from "next-intl/server";
import { navItems } from "~/lib/nav-items";
import { NavLink } from "./nav-link";

/**
 * Desktop navigation. Server component: labels and hrefs resolve at render
 * time, so no Menu messages ship to the client - only the tiny NavLink island
 * hydrates (for the aria-current active state).
 */
export async function Menu() {
  const t = await getTranslations("Menu");

  return (
    <nav className="hidden items-center gap-4 lg:flex xl:gap-6">
      {navItems.map(
        (item) =>
          t.has(`${item.key}.title`) && (
            <NavLink
              title={t(`${item.key}.hrefTitle`)}
              key={item.key}
              className="text-foreground/80 text-lg transition-colors hover:underline aria-[current=page]:underline"
              href={item.href}
            >
              {t(`${item.key}.title`)}
            </NavLink>
          ),
      )}
    </nav>
  );
}
