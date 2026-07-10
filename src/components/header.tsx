import Image from "next/image";
import Link from "next/link";
import LocaleSwitcher from "./locale-switcher";
import { Menu } from "./menu";
import { MobileNav } from "./mobile-menu";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import pick from "lodash/pick";

export async function Header({ withLangSwitcher = false }) {
  const messages = await getMessages();

  return (
    <header className="border-grid sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" title="Go to AIP Index">
            <Image
              // Explicit width + height at each breakpoint (not w-auto) so the
              // browser reserves the exact box before load - clears Lighthouse's
              // "unsized image element" and keeps the header from shifting. The
              // sizes match the previous rendered size (h-10 minus py-2/py-1 =
              // 24px / 32px tall) at the logo's 421:65 (~6.477) aspect ratio, so
              // it looks identical; items-center on the h-14 header row centers it.
              className="h-6 w-[155px] sm:h-8 sm:w-[207px]"
              src="/logo.webp"
              alt="AIP:Aero Logo"
              width={421}
              height={65}
              priority
            />
          </Link>

          {withLangSwitcher && (
            <NextIntlClientProvider messages={pick(messages, "Menu")}>
              <Menu />
            </NextIntlClientProvider>
          )}
          <NextIntlClientProvider messages={pick(messages, "LocaleSwitcher")}>
            <LocaleSwitcher />
          </NextIntlClientProvider>
          {withLangSwitcher && (
            <NextIntlClientProvider messages={pick(messages, "Menu")}>
              <MobileNav />
            </NextIntlClientProvider>
          )}
        </div>
      </div>
    </header>
  );
}
