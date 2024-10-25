/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/dot-notation,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-argument */

import { type NextRequest, NextResponse } from "next/server";
import getConfig from "next/config";
import fs from "fs";
import path from "path";
import { orgUrl } from "~/app/_components/metadata";
import { db } from "~/server/db";
import { airports, lower } from "~/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { htmlEscape } from "~/lib/html-escaper";

const messagesDirectory = path.join(process.cwd(), '/messages');

// generateStaticParams will be called at build time, important for sitemap.xml
export async function generateStaticParams() {
  return fs.readdirSync(messagesDirectory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ tld: file.replace('.json', '') }));
}

async function generateSitemap(fullPath: string, modifiedDate: string) {
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const data = JSON.parse(fileContents);
  const nativeLanguageCode: string = data.LanguageCode.native;
  const englishLanguageCode: string | undefined = data.LanguageCode.english;
  const pageKeys = Object.keys(data).filter((key) => key.endsWith('Page'));

  const pages = pageKeys.map((pageKey) => {
    const page = data[pageKey];
    const url = (new URL(page.native.href, orgUrl)).toString();
    return {
      url: url,
      lastModified: modifiedDate,
      alternates: englishLanguageCode ? {
        languages: {
          [nativeLanguageCode]: url,
          [englishLanguageCode]: (new URL(page.english.href, orgUrl)).toString(),
        },
      } : {
        languages: {
          [nativeLanguageCode]: url,
        },
      },
    };
  });

  // Get all airports of the country
  const airportsQuery = await db.query.airports.findMany({
    columns: {
      icao: true,
      title: true,
      type: true
    },
    where: eq(lower(airports.country), data.Tld.native.toLowerCase()),
    orderBy: [asc(airports.title)],
  })
  pages.push(...airportsQuery.map((airport) => {
    let airportHrefNative = '';
    let airportHrefEnglish = '';
    if (airport.type === "vfr") {
      airportHrefNative = data.VfrPage.native.href;
      airportHrefEnglish = data.VfrPage?.english?.href ?? airportHrefNative;
    }
    if (airport.type === "ifr") {
      airportHrefNative = data.IfrPage.native.href;
      airportHrefEnglish = data.IfrPage?.english?.href ?? airportHrefNative;
    }
    if (airport.type === "heliport") {
      airportHrefNative = data.HeliportPage.native.href;
      airportHrefEnglish = data.HeliportPage?.english?.href ?? airportHrefNative;
    }
    airportHrefNative += airport.icao === '' ? `?${htmlEscape(airport.title)}` : `?${airport.icao}`;
    airportHrefEnglish += airport.icao === '' ? `?${htmlEscape(airport.title)}` : `?${airport.icao}`;
    const airportUrlNative = new URL(airportHrefNative, orgUrl);
    const airportUrlEnglish = new URL(airportHrefEnglish, orgUrl);
    return {
      url: airportUrlNative.toString(),
      lastModified: modifiedDate,
      alternates: englishLanguageCode ? {
        languages: {
          [nativeLanguageCode]: airportUrlNative.toString(),
          [englishLanguageCode]: airportUrlEnglish.toString(),
        },
      } : {
        languages: {
          [nativeLanguageCode]: airportUrlNative.toString(),
        },
      },
    };
  }));
  return pages;
}

export async function GET(
  _: NextRequest, segmentData: { params: Promise<{ tld: string }> }) {
  const params = await segmentData.params
  const { publicRuntimeConfig } = getConfig() as { publicRuntimeConfig: { modifiedDate: string } };
  const modifiedDate = new Date(publicRuntimeConfig.modifiedDate);
  const formattedDate = modifiedDate.toISOString().split('T').at(0) ?? new Date().toISOString().split('T').at(0) ?? '';

  const fullPath = path.join(messagesDirectory, `${params.tld}.json`);
  if (!fs.existsSync(fullPath)) {
    return new NextResponse(null, {
      status: 404,
    });
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  // Map sortet messages to sitemap ids
  xml += (await generateSitemap(fullPath, formattedDate)).map(element => {
    /* For example:
    <url>
      <loc>https://aip.aero/de/vfr/?EDKA</loc>
      <lastmod>2024-07-19</lastmod>
      <xhtml:link rel="alternate" hreflang="de" href="https://aip.aero/de/vfr/?EDKA"/>
      <xhtml:link rel="alternate" hreflang="en" href="https://aip.aero/de/en/vfr/?EDKA"/>
    </url> */
    let elementXml = '<url>';
    elementXml += `<loc>${element.url}</loc>`;
    elementXml += `<lastmod>${element.lastModified}</lastmod>`;
    if (element.alternates) {
      for (const language in element.alternates.languages) {
        elementXml += `<xhtml:link rel="alternate" hreflang="${language}" href="${element.alternates.languages[language]}" />`;
      }
    }
    elementXml += '</url>';
    return elementXml;
  }).join('');
  xml += '</urlset>';

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}