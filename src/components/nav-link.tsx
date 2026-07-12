"use client";

import type { ComponentProps } from "react";
import { Link as IntLink, usePathname } from "~/i18n/routing";

/**
 * Navigation link with the active state marked as `aria-current="page"`.
 *
 * This is the ONLY client part of the header navigation: the header renders
 * once per locale layout (not per route), so the current pathname is not
 * available server-side and the active state needs `usePathname`. The link
 * labels arrive as server-rendered children - no translation messages are
 * serialized to the client for the navigation. Style the active state via
 * the `aria-[current=page]:` variant, which keeps semantics and styling in
 * one attribute.
 *
 * Must render inside a `NextIntlClientProvider` (next-intl's client `Link` /
 * `usePathname` resolve the locale from that context).
 */
export function NavLink(props: ComponentProps<typeof IntLink>) {
  const pathname = usePathname();
  return (
    <IntLink
      {...props}
      aria-current={pathname === props.href ? "page" : undefined}
    />
  );
}
