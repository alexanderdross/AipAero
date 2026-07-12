import type { Pathnames } from "~/i18n/routing";

/**
 * Single source for the header navigation entries, shared by the desktop menu
 * and the mobile dialog (they previously carried duplicated copies - a new
 * entry added to one silently missed the other). Which entries actually render
 * per locale is decided by `t.has("<key>.title")` against the Menu namespace,
 * same as before.
 */
export const navItems = [
  { href: "/", key: "home" },
  { href: "/vfr", key: "vfr" },
  { href: "/ifr", key: "ifr" },
  { href: "/heliports", key: "heliports" },
  { href: "/airport-list", key: "airports" },
  { href: "/aeroports", key: "aeroports" },
  { href: "/military", key: "military" },
] as const satisfies readonly { href: Pathnames; key: string }[];
