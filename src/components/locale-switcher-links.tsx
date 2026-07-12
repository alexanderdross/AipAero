"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  getPathname,
  type Locale,
  localeLangMapping,
  usePathname,
} from "~/i18n/routing";

type Props = {
  /** Accessible name for the language nav landmark. */
  label: string;
  /** Exactly the native + English option, labels like "🇩🇪 Deutsch". */
  options: { locale: string; label: string }[];
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

/**
 * Language toggle as two plain links (replaces the former Radix Select):
 * no dropdown JS, one tap instead of open-then-pick, crawlable alternate-
 * language links, and a full navigation so the new document carries the
 * correct `<html lang>` from the server. Client component only because the
 * target hrefs need the current pathname + search params; the labels arrive
 * as server-resolved props, so no messages ship for this. On small screens
 * the language name collapses to the flag (sr-only keeps the accessible
 * name). The current language is marked aria-current and stays a self-link.
 */
export default function LocaleSwitcherLinks({ label, options }: Props) {
  const currentLocale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = buildQuery(searchParams);

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {options.map((option) => {
        const localizedPath = getPathname({
          href: pathname,
          locale: option.locale as Locale,
        });
        const base = localizedPath.endsWith("/")
          ? localizedPath
          : `${localizedPath}/`; // match trailingSlash: true
        const href = query ? `${base}?${query}` : base;
        const lang = localeLangMapping[option.locale];
        // Labels are "<flag emoji> <name>"; split so the name can collapse
        // to sr-only on small screens while the flag stays visible.
        const [flag, ...name] = option.label.split(" ");
        return (
          <a
            key={option.locale}
            href={href}
            rel="alternate"
            hrefLang={lang}
            lang={lang}
            title={name.join(" ")}
            aria-current={option.locale === currentLocale ? "true" : undefined}
            className="text-foreground/80 hover:bg-drossgray aria-[current]:bg-drossgray flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm aria-[current]:font-semibold"
          >
            <span aria-hidden="true">{flag}</span>
            <span className="max-sm:sr-only">{name.join(" ")}</span>
          </a>
        );
      })}
    </nav>
  );
}
