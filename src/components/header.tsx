import Image from "next/image";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import LocaleSwitcher from "./locale-switcher";
import { Menu } from "./menu";
import { MobileNav } from "./mobile-menu";

export function Header({ withLangSwitcher = false }) {
  return (
    // backdrop-blur only from lg: on a sticky header it forces continuous
    // compositing while scrolling, which is measurable jank on low-end mobile
    // devices; bg-white/95 is visually near-opaque without the filter.
    <header className="border-grid sticky top-0 z-50 w-full border-b bg-white/95 lg:bg-white/90 lg:backdrop-blur">
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

          {/* ONE provider for the whole header, with an explicitly EMPTY
              messages object: every label is server-resolved and passed down
              as props, so zero header messages ship to the client. The
              provider still has to exist - next-intl's client Link /
              usePathname (NavLink, the language links, SchemaWebpage) resolve
              the locale from its context. Do not omit the messages prop:
              next-intl v4 would inherit and serialize ALL messages then. The
              provider adds no DOM node, so the flex row is unchanged. */}
          <NextIntlClientProvider messages={{}}>
            {withLangSwitcher && <Menu />}
            <LocaleSwitcher />
            {withLangSwitcher && <MobileNav />}
          </NextIntlClientProvider>
        </div>
      </div>
    </header>
  );
}
