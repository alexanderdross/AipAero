/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/dot-notation,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-argument */

import type { MetadataRoute } from 'next'
import { orgUrl } from '~/lib/generate-metadata'
import fs from 'fs';
import path from 'path';

const messagesDirectory = path.join(process.cwd(), '/messages');

export default function sitemap(): MetadataRoute.Sitemap {
  const messages = fs.readdirSync(messagesDirectory)
    .filter((file) => file.endsWith('.json'))
    .map((message) => {
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
      return pages;
    });

  return [
    {
      url: orgUrl.toString(),
      lastModified: new Date(),
    },
    ...messages.flat(),
  ];
}