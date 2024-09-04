"use client";

import { useMessages, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Menu() {
  const pathname = usePathname();
  const messages = useMessages();
  const language = pathname.includes('/en/') ? 'english' : 'native';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
  const keys = Object.keys(messages).filter((key) => key.endsWith('Page') && key !== 'NotFoundPage');
  console.log(keys);

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
            className="text-drossblue hover:underline mx-2"
          >
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */}
            {messages[key][language].hrefName}
          </Link>{idx < keys.length - 1 && '|'}
        </span>
      ))}
    </nav>
  );
}