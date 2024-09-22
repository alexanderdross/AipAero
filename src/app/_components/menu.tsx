"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Translation } from "~/lib/i18n";

export default function Menu({ translation }: { translation: Translation }) {
  const pathname = usePathname();  
  const pages = [
    translation.CountryPage, 
    translation.VfrPage, 
    translation.IfrPage, 
    translation.HeliportPage, 
    translation.AirportsPage
  ].filter(x => x !== undefined);

  return (
    <nav className="flex flex-wrap justify-center">
      {pages.map((page, idx) => (
        <span key={idx}>
          <Link
            href={page.href ?? ''}
            title={page.hrefTitle ?? ''}
            className={clsx('text-drossblue hover:underline mx-2', page.href === pathname && 'underline text-nowrap')}
            aria-disabled={page.href === pathname}
            target="_self"
            rel="noopener"
          >
            {page.menuTitle}
          </Link>{idx < pages.length - 1 && '|'}
        </span>
      ))}
    </nav>
  );
}