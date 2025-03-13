'use server';

import * as cheerio from 'cheerio';
import { type InsertAirport } from '~/server/db/schema';
import { cheerioFetch } from '~/lib/crawlers/utils';
import {slug} from 'github-slugger';
import { MUTATIONS } from '~/server/db/queries';
import { log } from 'next-axiom';

const COUNTRY = 'DE';
const rootVfrUrl = 'https://aip.dfs.de/BasicVFR/';
const rootIfrUrl = 'https://aip.dfs.de/BasicIFR/';

export async function crawlDe() {
  const airportsList: InsertAirport[] = [];
  const linkPromises = []

  async function getLink(rootUrl: string) {
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
      const linkPromises = []
      async function getLink(link: string, linkType: string) {
        const url = new URL(link, rootUrl);
        const response = await fetch(url, { cache: 'no-store' });
        const $ = cheerio.load(await response.text());
        const city = $('div.headlineText.left>span').first().text().trim();
        const icao = $('a.document-link>span.document-name').first().text().trim().match(/([A-Z]{4})/)?.at(0) ?? '';
        airportsList.push({
          icao: icao === '' ? null : icao,
          title: `${city} ${icao}`,
          url: url.toString(),
          type: linkType === 'aerodomes' ? 'ifr' : 'heliport',
          country: COUNTRY,
          slug: icao === '' ? slug(city) : icao
        });
      }
      for (const linkType of ['aerodomes', 'heliports']) {
        const links = linkType === 'aerodomes' ? aerodomeLinks : heliportLinks;
        for (const link of links) {
          linkPromises.push(getLink(link, linkType));
        }
      }
      await Promise.all(linkPromises);
    } else {
      const $aerodomes = cheerio.load(await cheerioFetch(rootUrl, responseText, 'a:contains("AD Aerodromes")', 'href'));
      const $heliports = cheerio.load(await cheerioFetch(rootUrl, responseText, 'a:contains("HEL AD Helicopter Aerodromes")', 'href'));
      // Remove the first 3 links as they are not airports (AD 0 Content, AD 1 General Remarks, AD 2 List of Aerodromes)
      const aerodomeLinks = $aerodomes('a.folder-link').map((_, el) => $aerodomes(el).attr('href')).get().slice(3);
      // Remove the first link as it is not an airport (HEL AD 3 List of Helicopter Aerodromes)
      const heliportLinks = $heliports('a.folder-link').map((_, el) => $heliports(el).attr('href')).get().slice(1);
      for (const linkType of ['aerodomes', 'heliports']) {
        const links = linkType === 'aerodomes' ? aerodomeLinks : heliportLinks;
        const linkPromises = []
        // We iterate through the A, B, C, ... links
        async function getLink(link: string) {
          const url = new URL(link, rootUrl);
          const response = await fetch(url, { cache: 'no-store' });
          const $ = cheerio.load(await response.text());
          $('a.folder-link').get().forEach((el) => {
            const href = $(el).attr('href') ?? '';
            const title = $(el).find('span').first().text().trim() ?? '';
            const icao = title.match(/([A-Z]{4})$/)?.at(0) ?? '';
            airportsList.push({
              icao: icao === '' ? null : icao,
              title: title,
              url: new URL(href, url).toString(),
              type: linkType === 'aerodomes' ? 'vfr' : 'heliport',
              country: COUNTRY,
              slug: icao === '' ? slug(title) : icao
            });
          });
        }
        for (const link of links) {
          linkPromises.push(getLink(link));
        }
        await Promise.all(linkPromises);
      }
    }
  }

  for (let rootUrl of [rootVfrUrl, rootIfrUrl]) {
    linkPromises.push(getLink(rootUrl));
  }
  await Promise.all(linkPromises);

  if (airportsList.length === 0) {
    throw new Error(`No ${COUNTRY} airports found`);
  }
  MUTATIONS.insertAirports({ airports: airportsList, country: COUNTRY });
  log.info(`Inserted ${airportsList.length} airports for ${COUNTRY}`);
}