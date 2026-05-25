import { NextResponse } from "next/server";
import getConfig from "next/config";
import { orgUrl } from "~/lib/utils";
import { routing } from "~/i18n/routing";

export async function GET() {
  const { publicRuntimeConfig } = getConfig() as {
    publicRuntimeConfig: { modifiedDate: string };
  };
  const modifiedDate = new Date(publicRuntimeConfig.modifiedDate);
  const formattedDate =
    modifiedDate.toISOString().split("T").at(0) ??
    new Date().toISOString().split("T").at(0) ??
    "";

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  // Map sortet messages to sitemap locations
  xml += routing.locales
    .filter((x) => x.length === 2)
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
    },
  });
}
