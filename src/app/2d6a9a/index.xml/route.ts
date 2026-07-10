import { NextResponse } from "next/server";
import { liveCountries, orgUrl } from "~/lib/utils";
import { routing } from "~/i18n/routing";
import { modifiedDate as buildDate } from "~/lib/build-info";

export async function GET() {
  const modifiedDate = new Date(buildDate);
  const formattedDate =
    modifiedDate.toISOString().split("T").at(0) ??
    new Date().toISOString().split("T").at(0) ??
    "";

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  // Map sorted messages to sitemap locations (live countries only; hidden
  // countries have no sitemap until their crawler is verified)
  xml += routing.locales
    .filter((x) => x.length === 2 && liveCountries.includes(x))
    .map((country) => {
      const sitemapUrl = new URL(
        `/2d6a9a/sitemap/${country}.xml`,
        orgUrl,
      ).toString();
      return `<sitemap><loc>${sitemapUrl}</loc><lastmod>${formattedDate}</lastmod></sitemap>`;
    })
    .join("");

  xml += "</sitemapindex>";

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      // The index only changes on deploy (lastmod = build date); 1h matches
      // the per-country sitemaps' revalidate. s-maxage is browser/edge intent -
      // on Workers it only takes effect once responses are put in an edge
      // cache, but it costs nothing and documents the freshness contract.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
