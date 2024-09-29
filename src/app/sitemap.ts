/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/dot-notation,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-argument */

import type { MetadataRoute } from 'next'
import { orgUrl } from "~/app/_components/metadata";
import fs from 'fs';
import path from 'path';
import { db } from '~/server/db';
import { asc, eq } from 'drizzle-orm';
import { airports } from '~/server/db/schema';

const messagesDirectory = path.join(process.cwd(), '/messages');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const messages = await Promise.all(fs.readdirSync(messagesDirectory)
    .filter((file) => file.endsWith('.json'))
    .map(async (message) => {
      const fullPath = path.join(messagesDirectory, message);
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
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.5,
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
          type: true
        },
        where: eq(airports.country, data.CountryCode.english),
        orderBy: [asc(airports.title)],
      })
      /*pages.push(...airportsQuery.map((airport) => {
        const airportUrl = new URL(data.AirportsPage.native.href, orgUrl);
        airportUrl.pathname = `${airportUrl.pathname}${airport.icao}`;
        return {
          url: airportUrl.toString(),
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.5,
          alternates: englishLanguageCode ? {
            languages: {
              [nativeLanguageCode]: airportUrl.toString(),
              [englishLanguageCode]: new URL(data.AirportsPage.english.href, orgUrl).toString(),
            },
          } : {
            languages: {
              [nativeLanguageCode]: airportUrl.toString(),
            },
          },
        };
      }));*/
      return pages;
    }));

  return [
    {
      url: orgUrl.toString(),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...messages.flat(),
  ];
}