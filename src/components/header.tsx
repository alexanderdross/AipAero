import Image from 'next/image';
import Link from 'next/link';
import {Link as IntLink} from '~/i18n/routing';
import LocaleSwitcher from './locale-switcher';

import { getTranslations } from 'next-intl/server';

export async function Header({ withLangSwitcher = false }) {
  const t = await getTranslations('Header');

  return (
    <header className="border-grid sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-white">
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
              sizes="33vw"
            />
          </Link>
          {withLangSwitcher && <nav className="flex items-center gap-4 text-sm xl:gap-6">
            <IntLink className="transition-colors hover:underline text-foreground/80" href="/">{t('home.title')}</IntLink>
            <IntLink className="transition-colors hover:underline text-foreground" href="/vfr">{t('vfr.title')}</IntLink>
            {t.has('ifr.title') && <IntLink className="transition-colors hover:underline text-foreground" href="/ifr">{t('ifr.title')}</IntLink>}
            <IntLink className="transition-colors hover:underline text-foreground/80" href="/heliports">{t('heliports.title')}</IntLink>
            <IntLink className="transition-colors hover:underline text-foreground/80" href="/airport-list">{t('airports.title')}</IntLink>
          </nav>}
          {withLangSwitcher && <LocaleSwitcher />}
        </div>
      </div>
    </header>
  );
}
