'use server';

import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { airports } from '~/server/db/schema';
import { type Airport, cheerioFetch } from '~/lib/crawlers/utils';

const rootVfrUrl = 'https://aip.dfs.de/BasicVFR/';
const rootIfrUrl = 'https://aip.dfs.de/BasicIFR/';

export async function crawl_de() {
  const airportsList: Airport[] = [];
  for (let rootUrl of [rootVfrUrl, rootIfrUrl]) {
    // Start at the LVNL main page
    let response = await fetch(rootUrl, { cache: 'no-store' });
    // Check if we were redirected to the current date page
    if (rootUrl !== response.url) {
      rootUrl = response.url;
      response = await fetch(rootUrl, { cache: 'no-store' });
    }
    let responseText = await response.text();

    if (rootUrl.includes('BasicIFR')) {
      // In case of IFR, we need to go one level deeper the to have the same logic as VFR
      responseText = await cheerioFetch(rootUrl, responseText, 'a:contains("AD Aerodromes")', 'href');
      const $aerodomes = cheerio.load(await cheerioFetch(rootUrl, responseText, 'a:contains("AD 2 Aerodromes")', 'href'));
      const $heliports = cheerio.load(await cheerioFetch(rootUrl, responseText, 'a:contains("AD 3 Heliports")', 'href'));
      const aerodomeLinks = [...new Set($aerodomes('a.folder-link').map((_, el) => $aerodomes(el).attr('href')).get())];
      const heliportLinks = [...new Set($heliports('a.folder-link').map((_, el) => $heliports(el).attr('href')).get())];
      for (const linkType of ['aerodomes', 'heliports']) {
        const links = linkType === 'aerodomes' ? aerodomeLinks : heliportLinks;
        for (const link of links) {
          const url = new URL(link, rootUrl);
          const response = await fetch(url, { cache: 'no-store' });
          const $ = cheerio.load(await response.text());
          const city = $('div.headlineText.left>span').first().text().trim();
          const icao = $('a.document-link>span.document-name').first().text().trim().match(/([A-Z]{4})/)?.at(0) ?? '';
          airportsList.push({
            icao,
            title: `${city} ${icao}`,
            url: url.toString(),
            type: linkType === 'aerodomes' ? 'ifr' : 'heliport',
            country: 'DE'
          });
        }
      }
    } else {
      const $aerodomes = cheerio.load(await cheerioFetch(rootUrl, responseText, 'a:contains("AD Aerodromes")', 'href'));
      const $heliports = cheerio.load(await cheerioFetch(rootUrl, responseText, 'a:contains("HEL AD Helicopter Aerodromes")', 'href'));
      // Remove the first 3 links as they are not airports (AD 0 Content, AD 1 General Remarks, AD 2 List of Aerodromes)
      const aerodomeLinks = $aerodomes('a.folder-link').map((_, el) => $aerodomes(el).attr('href')).get().slice(3);
      // Remove the first link as it is not an airport (HEL AD 3 List of Helicopter Aerodromes)
      const heliportLinks = $heliports('a.folder-link').map((_, el) => $heliports(el).attr('href')).get().slice(1);
      for (const linkType of ['aerodomes', 'heliports']) {
        const links = linkType === 'aerodomes' ? aerodomeLinks : heliportLinks;
        // We iterate through the A, B, C, ... links
        for (const link of links) {
          const url = new URL(link, rootUrl);
          const response = await fetch(url, { cache: 'no-store' });
          const $ = cheerio.load(await response.text());
          $('a.folder-link').get().forEach((el) => {
            const href = $(el).attr('href') ?? '';
            const title = $(el).find('span').first().text().trim() ?? '';
            const icao = title.match(/([A-Z]{4})$/)?.at(0) ?? '';
            airportsList.push({
              icao,
              title,
              url: new URL(href, url).toString(),
              type: linkType === 'aerodomes' ? 'vfr' : 'heliport',
              country: 'DE'
            });
          });
        }
      }
    }
  }
  
  await db.delete(airports).where(eq(airports.country, 'DE')).execute();
  await db.insert(airports).values(airportsList).execute();
  return airportsList;
}