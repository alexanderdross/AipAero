import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import LinkHeader from "http-link-header";
import { localeLangMapping, routing } from "./i18n/routing";
import { countryAnchorSlug, countryMeta, liveCountries } from "./lib/utils";

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

  // German legal pages live under `/de/` publicly (impressum/datenschutz/agb),
  // but are served by the ROOT German legal routes (src/app/{impressum,
  // datenschutz,agb}) - they cannot be real `[locale]` routes without the site
  // header's language switcher linking to a non-existent /de/en/... twin. So we
  // internally REWRITE the public /de/... path onto the root route (URL stays
  // /de/impressum), and 301 the bare root path to the canonical /de/... URL.
  // The German contact page (/de/kontakt/) follows the same pattern as the
  // German legal pages: a root route (src/app/kontakt) served under /de/ via an
  // internal rewrite, with the bare root path 301'd to the canonical /de/ URL.
  const deLegal = /^\/de\/(impressum|datenschutz|agb|kontakt)\/?$/.exec(
    pathname,
  );
  if (deLegal) {
    const url = request.nextUrl.clone();
    url.pathname = `/${deLegal[1]}/`;
    return NextResponse.rewrite(url);
  }
  const rootLegal = /^\/(impressum|datenschutz|agb|kontakt)\/?$/.exec(pathname);
  if (rootLegal) {
    const url = request.nextUrl.clone();
    url.pathname = `/de/${rootLegal[1]}/`;
    return NextResponse.redirect(url, 301);
  }

  // Legacy locale-prefixed legal URLs -> root. The legal pages used to live
  // under every locale (`/de/terms`, `/de/en/terms`, ...); they are now single
  // root-level bilingual pages (`/terms`, `/imprint`, `/privacy`). 301-redirect
  // the old indexed terms URLs (and any guessed imprint/privacy under a locale)
  // to the canonical root so link equity is preserved and no page 404s.
  const legalMatch = /^\/[a-z]{2}(?:\/en)?\/(terms|imprint|privacy)\/?$/.exec(
    pathname,
  );
  if (legalMatch) {
    const url = new URL(request.url);
    url.pathname = `/${legalMatch[1]}/`;
    url.search = "";
    return NextResponse.redirect(url, 301);
  }

  // Country short URLs: /germany -> /#germany (the homepage card anchor).
  // Derived from liveCountries x countryMeta, so a launched country gets its
  // short URL automatically. Locale prefixes ('/de') never collide - the
  // slugs are full English names ('germany').
  const slugMatch = /^\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (slugMatch) {
    const slug = slugMatch[1]!;
    const isCountrySlug = liveCountries.some(
      (cc) => countryAnchorSlug(countryMeta[cc]?.name ?? "") === slug,
    );
    if (isCountrySlug) {
      const url = new URL(request.url);
      url.pathname = "/";
      url.hash = slug;
      return NextResponse.redirect(url, 308);
    }
  }

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
