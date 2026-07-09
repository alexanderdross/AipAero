"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { type Locale, getPathname, usePathname } from "~/i18n/routing";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type Props = {
  children: ReactNode;
  defaultValue: string;
  label: string;
};

// Serialize search params while preserving the site's valueless-key airport
// scheme: `?EDFY` (a key with no value) must stay `?EDFY`, not become `?EDFY=`
// the way `URLSearchParams`/object queries render an empty value. Normal
// key=value params are still encoded as usual. Returns "" when there are none.
function buildQuery(params: URLSearchParams): string {
  const parts: string[] = [];
  params.forEach((value, key) => {
    parts.push(
      value === ""
        ? encodeURIComponent(key)
        : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    );
  });
  return parts.join("&");
}

export default function LocaleSwitcherSelect({
  children,
  defaultValue,
  label,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onSelectChange(value: string) {
    const nextLocale = value as Locale;
    // Build the localized target path (locale prefix + localized pathname slug)
    // via next-intl, then append the query ourselves. next-intl's typed router
    // only takes a Record query, which would re-encode the valueless airport
    // key as `?EDFY=`; keeping the query as a raw string preserves `?EDFY`.
    const localizedPath = getPathname({ href: pathname, locale: nextLocale });
    const base = localizedPath.endsWith("/")
      ? localizedPath
      : `${localizedPath}/`; // match trailingSlash: true
    const query = buildQuery(searchParams);
    const href = query ? `${base}?${query}` : base;
    startTransition(() => {
      router.replace(href);
    });
  }

  return (
    <Select
      defaultValue={defaultValue}
      disabled={isPending}
      onValueChange={onSelectChange}
    >
      <SelectTrigger className="w-32" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
