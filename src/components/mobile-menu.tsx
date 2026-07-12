import { getTranslations } from "next-intl/server";
import { navItems } from "~/lib/nav-items";
import { MobileNavDialog } from "./mobile-nav-dialog";
import { NavLink } from "./nav-link";

/**
 * Mobile navigation. Server component: the link list is real SSR HTML (inside
 * the closed native `<dialog>` - see MobileNavDialog), so crawlers see the
 * nav under mobile-first indexing and no Menu messages ship to the client.
 * Rows are full-width, min-h-12 tap targets with dividers; the active page is
 * marked via aria-current (NavLink).
 */
export async function MobileNav() {
  const t = await getTranslations("Menu");

  return (
    <MobileNavDialog label={t("label")} closeLabel={t("close")}>
      <nav aria-label={t("label")}>
        <ul className="divide-border divide-y">
          {navItems.map(
            (item) =>
              t.has(`${item.key}.title`) && (
                <li key={item.key}>
                  <NavLink
                    title={t(`${item.key}.hrefTitle`)}
                    href={item.href}
                    className="text-drossgray-dark aria-[current=page]:text-drossblue flex min-h-12 items-center px-6 text-base aria-[current=page]:font-semibold"
                  >
                    {t(`${item.key}.title`)}
                  </NavLink>
                </li>
              ),
          )}
        </ul>
      </nav>
    </MobileNavDialog>
  );
}
