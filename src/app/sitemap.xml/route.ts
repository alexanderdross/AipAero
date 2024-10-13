import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import getConfig from "next/config";
import { orgUrl } from "~/app/_components/metadata";

const messagesDirectory = path.join(process.cwd(), '/messages');

export async function GET() {
  const { publicRuntimeConfig } = getConfig() as { publicRuntimeConfig: { modifiedDate: string } };
  const modifiedDate = new Date(publicRuntimeConfig.modifiedDate);
  const formattedDate = modifiedDate.toISOString().split('T').at(0) ?? new Date().toISOString().split('T').at(0) ?? '';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  // Map sortet messages to sitemap locations
  xml += fs.readdirSync(messagesDirectory)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map(file => {
      const country = file.replace('.json', '');
      const sitemapUrl = new URL(`/${country}/sitemap.xml`, orgUrl).toString();
      return `<sitemap><loc>${sitemapUrl}</loc><lastmod>${formattedDate}</lastmod></sitemap>`
    }).join('');

  xml += '</sitemapindex>';

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}