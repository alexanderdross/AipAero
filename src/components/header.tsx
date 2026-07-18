import Image from "next/image";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import LocaleSwitcher from "./locale-switcher";
import { Menu } from "./menu";
import { MobileNav } from "./mobile-menu";

export async function Header({
  withLangSwitcher = false,
  withLocaleSwitcher = true,
}) {
  const tCommon = await getTranslations("Common");

  return (
    // ONE provider around header + mobile pill bar, with an explicitly EMPTY
    // messages object: every label is server-resolved and passed down as
    // props, so zero header messages ship to the client. The provider still
    // has to exist - next-intl's client Link / usePathname (NavLink, the
    // language links, SchemaWebpage) resolve the locale from its context. Do
    // not omit the messages prop: next-intl v4 would inherit and serialize
    // ALL messages then. The provider adds no DOM node.
    <NextIntlClientProvider messages={{}}>
      {/* backdrop-blur only from lg: on a sticky header it forces continuous
          compositing while scrolling, which is measurable jank on low-end
          mobile devices; bg-white/95 is visually near-opaque without it. */}
      <header className="border-grid sticky top-0 z-50 w-full border-b bg-white/95 lg:bg-white/90 lg:backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            {/* Localized, keyword-rich title describing the link target (the
                global AIP index) - was a hardcoded English string. */}
            <Link href="/" title={tCommon("homeLink")}>
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

            {withLangSwitcher && <Menu />}
            {/* The site's URL-driven locale switcher assumes each page has a
                `<cc>`/`<cc>/en` pair. The root legal pages have no such twin
                (their English/German counterpart is a different root/`/de/`
                URL), so it would link to a non-existent `/de/en/agb` etc. -
                those pages pass `withLocaleSwitcher={false}` and carry their own
                language toggle instead. */}
            {withLocaleSwitcher && <LocaleSwitcher />}
          </div>
        </div>
      </header>
      {/* Mobile pill navigation OUTSIDE the sticky <header>: inside it, the
          bar would be pinned and permanently cost ~50px of mobile viewport -
          it scrolls away with the page instead (see MobileNav). */}
      {withLangSwitcher && <MobileNav />}
    </NextIntlClientProvider>
  );
}
