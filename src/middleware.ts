import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import LinkHeader from "http-link-header";
import { localeLangMapping, routing } from "./i18n/routing";
import { countryAnchorSlug, countryMeta, liveCountries } from "./lib/utils";

const handleI18nRouting = createMiddleware(routing);

// The five airport search/detail routes (`/vfr`, `/ifr`, `/heliports`,
// `/military`, `/aeroports`) read `searchParams` for the `?ICAO` scheme, so
// they are ALWAYS dynamically rendered and Next.js emits
// `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` for
// them. The `no-store` directive makes Chrome refuse the page for the
// back/forward cache (bfcache) - Lighthouse flags this as "Page prevented
// back/forward cache restoration". We strip ONLY `no-store` on these routes so
// the browser can keep an in-memory snapshot for instant back/forward, while
// `private, no-cache, max-age=0, must-revalidate` keeps them per-request SSR
// (no shared/CDN cache ever stores or serves them stale - the ?ICAO pages stay
// dynamic). The slugs are uniform across locales (see routing.pathnames), so
// the last path segment identifies them regardless of locale prefix.
const SEARCH_ROUTE_SLUGS = new Set([
  "vfr",
  "ifr",
  "heliports",
  "military",
  "aeroports",
]);
const BFCACHE_FRIENDLY_CACHE_CONTROL =
  "private, no-cache, max-age=0, must-revalidate";

function isDynamicSearchRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last !== undefined && SEARCH_ROUTE_SLUGS.has(last);
}

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

  // Make the dynamic ?ICAO search/detail routes bfcache-eligible by dropping
  // `no-store` (Next.js sets it on every dynamic render). OpenNext applies
  // middleware response headers over the Next-server response, so this
  // Cache-Control wins - verified via the same override path the `link` header
  // above uses. Only these routes are touched; the ISR/static pages keep their
  // own (s-maxage) caching headers.
  if (isDynamicSearchRoute(pathname)) {
    response.headers.set("cache-control", BFCACHE_FRIENDLY_CACHE_CONTROL);
  }
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
