'use server';

import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { airports } from '~/server/db/schema';
import { type Airport } from '~/lib/crawlers/utils';

const rootUrl = 'https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/';

function extractAirports($: cheerio.CheerioAPI, selector: string, url: string, type: 'vfr' | 'ifr' | 'heliport') {
  const heliportRows = $(selector);
  const airports: Airport[] = [];
  for (const row of heliportRows) {
    const element = $(row).find('a').last();
    const text = element.text().trim();
    const icao = text.split(' ')[0]?.trim();
    const title = text.split(' ').slice(1).join(' ').split(';')[0]?.replace('TAD_HP', '') + ' ' + icao;
    // Find the chart details
    const adDetails = $(row).next().find('a').filter((_,el) => $(el).text().includes('CHARTS RELATED'));
    const href = adDetails.attr('href');
    if (!href) {
      continue;
    }
    const fullUrl = new URL(href, url).toString();
    airports.push({ icao, title: title, url: fullUrl, type, country: 'UK' } as Airport);
  }
  return airports;
}

export async function crawl_uk() {
  // Start at the LVNL main page
  let response = await fetch(rootUrl);
  let $ = cheerio.load(await response.text());
  const eaipUrl = $('a:contains("Current AIRAC")').attr('href');
  if (!eaipUrl) {
    throw new Error(`Could not find the "eAIP" link button in ${rootUrl}`);
  }
  // Go to the eAIP page
  response = await fetch(eaipUrl);
  $ = cheerio.load(await response.text());
  let href = $('frame[name="eAISNavigationBase"]').attr('src');
  if (!href) {
    throw new Error(`Could not find the "eAISNavigationBase" frame in ${eaipUrl}`);
  }
  // Go to the eAISNavigationBase
  let url = new URL(href, eaipUrl).toString();
  response = await fetch(url);
  $ = cheerio.load(await response.text());
  href = $('frame[name="eAISNavigation"]').attr('src');
  if (!href) {
    throw new Error(`Could not find the "eAISNavigation" frame in ${url}`);
  }
  // Go to the eAISNavigation
  url = new URL(href, url).toString();
  response = await fetch(url);
  $ = cheerio.load(await response.text());
  // Extract VFR airports
  const airportsList = extractAirports($, '#AD-2details>.Hx', url, 'vfr');
  airportsList.push(...extractAirports($, '#AD-3details>.Hx', url, 'heliport'));
  
  if (airportsList.length === 0) {
    throw new Error('No UK airports found');
  }
  await db.delete(airports).where(eq(airports.country, 'UK')).execute();
  await db.insert(airports).values(airportsList).execute();
  return airportsList;
}