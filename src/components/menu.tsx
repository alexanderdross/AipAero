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
    // Same localized landmark label as the mobile pill nav - only one of the
    // two is visible per breakpoint, so screen readers always find exactly
    // one "Menu" navigation.
    <nav
      aria-label={t("label")}
      className="hidden items-center gap-4 lg:flex xl:gap-6"
    >
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
