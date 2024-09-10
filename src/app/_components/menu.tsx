"use client";

import clsx from "clsx";
import { useMessages } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Menu() {
  const pathname = usePathname();
  const messages = useMessages();
  const language = pathname.includes('/en/') ? 'english' : 'native';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
  const keys = Object.keys(messages).filter((key) => key.endsWith('Page') && key !== 'NotFoundPage');

  return (
    <nav className="flex justify-center py-8">
      {keys.map((key, idx) => (
        <span key={idx}>
          <Link
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
            key={messages[key][language].href}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
            href={messages[key][language].href}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
            title={messages[key][language].hrefTitle}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
            className={clsx('text-drossblue hover:underline mx-2', messages[key][language].href === pathname && 'font-medium text-gray-500 hover:no-underline pointer-events-none')}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
            aria-disabled={messages[key][language].href === pathname}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */}
            {messages[key][language].hrefName}
          </Link>{idx < keys.length - 1 && '|'}
        </span>
      ))}
    </nav>
  );
}