import { NextResponse } from "next/server";
import { liveCountries, orgUrl } from "~/lib/utils";
import { routing } from "~/i18n/routing";
import { modifiedDate as buildDate } from "~/lib/build-info";
import { QUERIES } from "~/server/db/queries";

// ISR safety net: the per-country lastmod comes from the crawl timestamp
// (crawlUpdatedAt, country-tagged). A crawler POST busts that inner cache;
// this bounds how long the index lags the crawl even without the post-deploy
// revalidate (mirrors airport-list/page.tsx and 2d6a9a/sitemap.ts).
export const revalidate = 3600;

function isoDay(d: Date): string {
  return (
    d.toISOString().split("T").at(0) ??
    new Date(buildDate).toISOString().split("T").at(0) ??
    ""
  );
}

export async function GET() {
  const buildDay = isoDay(new Date(buildDate));

  const countries = routing.locales.filter(
    (x) => x.length === 2 && liveCountries.includes(x),
  );

  // Per-country lastmod = the real crawl timestamp (tagged, so a fresh
  // crawler POST busts it and moves the date daily), falling back to the
  // build date for a country not yet crawled since deploy. A static index
  // lastmod is what Bing WMT flags as stale ("update at least once a day").
  const entries = await Promise.all(
    countries.map(async (country) => {
      const crawledAtUnix = await QUERIES.crawlUpdatedAt(country);
      const lastmod = crawledAtUnix
        ? isoDay(new Date(crawledAtUnix * 1000))
        : buildDay;
      const sitemapUrl = new URL(
        `/2d6a9a/sitemap/${country}.xml`,
        orgUrl,
      ).toString();
      return `<sitemap><loc>${sitemapUrl}</loc><lastmod>${lastmod}</lastmod></sitemap>`;
    }),
  );

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  xml += entries.join("");
  xml += "</sitemapindex>";

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      // Per-country lastmod tracks the daily crawl; 1h matches the
      // per-country sitemaps' revalidate. s-maxage is browser/edge intent -
      // on Workers it only takes effect once responses are put in an edge
      // cache, but it costs nothing and documents the freshness contract.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
