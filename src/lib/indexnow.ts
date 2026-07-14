import { env } from "~/env";
import { getPathname, isSingleLocale, type Locale } from "~/i18n/routing";
import { orgUrl } from "~/lib/utils";

// IndexNow (https://www.indexnow.org): one POST notifies Bing + the partner
// engines (Yandex, Seznam, Naver) that URLs changed, so they re-crawl on
// demand instead of waiting for their organic schedule. The api.indexnow.org
// endpoint fans the ping out to all participants. See docs/indexnow-concept.md.
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

function trailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}

/**
 * The URLs that VISIBLY change on every crawl of `country` (uppercase code,
 * e.g. "DE"): the country landing and airport-list pages, native + English.
 * Detail pages barely change day to day (same chart link), so they are
 * deliberately out of the per-crawl ping (Phase 2 would add diff-based detail
 * submits - see the concept doc).
 */
function countryChangeUrls(country: string): string[] {
  const native = country.toLowerCase();
  const locales: Locale[] = (
    isSingleLocale(native) ? [native] : [native, `${native}-EN`]
  ) as Locale[];
  const urls: string[] = [];
  for (const locale of locales) {
    for (const href of ["/", "/airport-list"] as const) {
      const path = trailingSlash(getPathname({ href, locale }));
      urls.push(new URL(path, orgUrl).toString());
    }
  }
  return urls;
}

/**
 * Notify IndexNow that `country`'s landing + list pages changed. Fire and
 * forget from `ctx.waitUntil` (never blocks the crawler POST response),
 * fully fail-soft, and a NO-OP when `INDEXNOW_KEY` is unset - so deploys work
 * before the var is configured. The key is public by design (served at
 * `/<key>.txt`); `keyLocation` points crawlers at it for ownership proof.
 */
export async function submitCountryToIndexNow(country: string): Promise<void> {
  const key = env.INDEXNOW_KEY;
  if (!key) return;
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
        urlList: countryChangeUrls(country),
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
