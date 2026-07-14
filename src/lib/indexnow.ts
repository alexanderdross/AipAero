import { env } from "~/env";
import { getPathname, isSingleLocale, type Locale } from "~/i18n/routing";
import { i18nPathMapping, orgUrl } from "~/lib/utils";
import type { Airport } from "~/server/db/schema";

// IndexNow (https://www.indexnow.org): one POST notifies Bing + the partner
// engines (Yandex, Seznam, Naver) that URLs changed, so they re-crawl on
// demand instead of waiting for their organic schedule. The api.indexnow.org
// endpoint fans the ping out to all participants. See docs/indexnow-concept.md.
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
// IndexNow accepts up to 10,000 URLs per request; a country's first publish
// (empty snapshot -> every airport counts as "added") is the only case that
// approaches this, and even DE (~800 fields x 2 locales) stays well under.
const MAX_URLS = 10_000;

/** One airport-detail page identified by its type (the search-route path) and
 *  slug (the `?<slug>` query key), for the changed-detail ping. */
export type ChangedDetail = { type: Airport["type"]; slug: string };

function trailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}

/** Native + English locales of a country (uppercase code); single-locale
 *  countries (uk, be) have no `-EN` twin. */
function countryLocales(country: string): Locale[] {
  const native = country.toLowerCase();
  return (
    isSingleLocale(native) ? [native] : [native, `${native}-EN`]
  ) as Locale[];
}

/** Country landing + airport-list pages (native + EN) - the URLs that VISIBLY
 *  change on every crawl (stand date, list contents). */
function countryChangeUrls(country: string): string[] {
  const urls: string[] = [];
  for (const locale of countryLocales(country)) {
    for (const href of ["/", "/airport-list"] as const) {
      urls.push(
        new URL(
          trailingSlash(getPathname({ href, locale })),
          orgUrl,
        ).toString(),
      );
    }
  }
  return urls;
}

/** Airport-detail URLs (native + EN) for the airfields that appeared or
 *  disappeared this crawl - matches the sitemap's `${path}?${slug}` scheme so
 *  IndexNow submits exactly the URLs the sitemap already advertises. */
function detailUrls(country: string, details: ChangedDetail[]): string[] {
  const locales = countryLocales(country);
  const urls: string[] = [];
  for (const { type, slug } of details) {
    const href = i18nPathMapping[type];
    for (const locale of locales) {
      urls.push(
        new URL(`${getPathname({ locale, href })}?${slug}`, orgUrl).toString(),
      );
    }
  }
  return urls;
}

/**
 * Notify IndexNow that `country`'s pages changed: always the landing + list
 * pages, plus the detail pages of airfields that appeared/disappeared this
 * crawl (`changedDetails` - new ones get indexed immediately, removed ones get
 * re-crawled so the engine sees the 404). Fire and forget from `ctx.waitUntil`
 * (never blocks the crawler POST response), fully fail-soft, and a NO-OP
 * without `INDEXNOW_KEY`. The key is public by design (served at `/<key>.txt`);
 * `keyLocation` points crawlers at it for ownership proof.
 */
export async function submitCountryToIndexNow(
  country: string,
  changedDetails: ChangedDetail[] = [],
): Promise<void> {
  const key = env.INDEXNOW_KEY;
  if (!key) return;
  const urlList = [
    ...new Set([
      ...countryChangeUrls(country),
      ...detailUrls(country, changedDetails),
    ]),
  ].slice(0, MAX_URLS);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: orgUrl.host,
        key,
        keyLocation: new URL(`/${key}.txt`, orgUrl).toString(),
        urlList,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    // 200 / 202 = accepted; anything else is logged, never thrown.
    if (!res.ok) {
      console.warn(`IndexNow submit for ${country}: HTTP ${res.status}`);
    }
  } catch (error) {
    console.warn(`IndexNow submit for ${country} failed:`, error);
  }
}
