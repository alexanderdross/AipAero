import { getTranslations } from "next-intl/server";
import { navItems } from "~/lib/nav-items";
import { NavLink } from "./nav-link";

/**
 * Mobile navigation as a horizontally scrollable pill bar below the sticky
 * header row (replaces the former hamburger + dialog: zero dialog JS, one
 * less tap, and every destination is immediately visible instead of hidden
 * behind an icon). Server component - the links are plain SSR HTML in the
 * document flow (mobile-first indexing sees a real always-visible `<nav>`),
 * the only hydrated part is NavLink's aria-current active state. The bar
 * scrolls away with the page on purpose: keeping it sticky would cost
 * ~50px of every mobile viewport permanently. Countries have 3-6 entries;
 * overflow scrolls horizontally (scrollbar hidden, partial pill peeks as
 * the affordance).
 */
export async function MobileNav() {
  const t = await getTranslations("Menu");

  return (
    <nav
      aria-label={t("label")}
      className="border-grid [scrollbar-width:none] overflow-x-auto border-b bg-white lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      <ul className="mx-auto flex w-max max-w-7xl min-w-full gap-2 px-4 py-2 sm:px-6">
        {navItems.map(
          (item) =>
            t.has(`${item.key}.title`) && (
              <li key={item.key}>
                <NavLink
                  title={t(`${item.key}.hrefTitle`)}
                  href={item.href}
                  className="text-foreground/80 aria-[current=page]:border-drossblue aria-[current=page]:bg-drossblue flex min-h-10 items-center rounded-full border px-3 text-sm whitespace-nowrap aria-[current=page]:font-semibold aria-[current=page]:text-white"
                >
                  {t(`${item.key}.title`)}
                </NavLink>
              </li>
            ),
        )}
      </ul>
    </nav>
  );
}
