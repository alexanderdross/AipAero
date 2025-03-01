import Image from 'next/image';
import Link from 'next/link';
import LocaleSwitcher from './locale-switcher';
import { Menu } from './menu';
import { MobileNav } from './mobile-menu';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { pick } from 'lodash';

export async function Header({ withLangSwitcher = false }) {
  const messages = await getMessages();

  return (
    <header className="border-grid sticky top-0 z-50 w-full border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between">
          <Link
            href="/"
            title='Go to AIP Index'
          >
            <Image
              className='h-10 w-auto py-2 sm:py-1'
              src="/logo.webp"
              width={1071}
              height={450}
              priority={true}
              alt="AIP:Aero Logo"
              quality={75}
              sizes="33vw"
            />
          </Link>

          {withLangSwitcher && <NextIntlClientProvider
            messages={
              pick(messages, 'Menu')
            }>
            <Menu />
          </NextIntlClientProvider>}
          <LocaleSwitcher />
          {withLangSwitcher && <NextIntlClientProvider
            messages={
              pick(messages, 'Menu')
            }>
            <MobileNav />
          </NextIntlClientProvider>}
        </div>
      </div>
    </header>
  );
}
