import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import LinkHeader from "http-link-header";
import { localeLangMapping, routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Redirect the www host to the canonical apex domain (301). Both hostnames
  // are bound to this Worker as custom domains (see wrangler.jsonc).
  const host = request.headers.get("host");
  if (host === "www.aip.aero") {
    const url = new URL(request.url);
    url.host = "aip.aero";
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = request.nextUrl;

  // Matches '/', as well as all paths that start with a locale like '/en'
  const shouldHandle =
    pathname === "/" ||
    new RegExp(`^/(${routing.locales.join("|")})(/.*)?$`).test(
      request.nextUrl.pathname,
    );
  if (!shouldHandle) return;

  if (pathname === "/") {
    return;
  }

  const response = handleI18nRouting(request);
  // See https://next-intl.dev/docs/routing#alternate-links-customization
  const link = LinkHeader.parse(response.headers.get("link") ?? "");
  link.refs.forEach((entry) => {
    entry.hreflang =
      localeLangMapping[entry.hreflang as (typeof routing.locales)[number]] ??
      "";
  });
  response.headers.set("link", link.toString());
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
