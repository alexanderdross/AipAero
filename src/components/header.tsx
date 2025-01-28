import Image from 'next/image';
import Link from 'next/link';
import LocaleSwitcher from './locale-switcher';

export function Header({withLangSwitcher = false}) {
  return (
    <header className="border-grid sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="container flex h-12 items-center justify-between">
          <div className="mr-4">
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
          </div>
          {withLangSwitcher && <LocaleSwitcher />}
        </div>
      </div>
    </header>
  );
}
