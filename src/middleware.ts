import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales } from '~/config';
 
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isMain = pathname === '/';

  const intlMiddleware = createMiddleware({
    locales,
    defaultLocale,
  });

  if (isMain) {
    // Add a hint that we can read in `i18n.ts`
    request.headers.set('x-app-route', 'true');
    return NextResponse.next({request: {headers: request.headers}});
  } else {
    return intlMiddleware(request);
  }
}

export const config = {
  // Match only internationalized pathnames
  matcher: ["/", "/(uk|de|de\/en|nl|nl\/en)/:path*"]
};