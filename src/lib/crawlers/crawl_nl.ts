'use server';

import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { airports } from '~/server/db/schema';

const rootUrl = 'https://www.lvnl.nl/diensten/aip';

interface Airport {
  icao: string;
  title: string;
  url: string;
  type: 'vfr' | 'ifr' | 'heliport';
  country: string;
}

function extractAirports($: cheerio.CheerioAPI, selector: string, url: string, type: 'vfr' | 'ifr' | 'heliport') {
  const heliportRows = $(selector);
  const airports: Airport[] = [];
  for (const row of heliportRows) {
    const element = $(row).find('a').last();
    const text = element.text().trim();
    const icao = text.split('—')[0]?.trim();
    const title = text.split('—')[1]?.trim() + ' ' + icao;
    // Find the chart details
    const adDetails = $(row).next().find('a').last();
    const href = adDetails.attr('href');
    if (!href) {
      continue;
    }
    const fullUrl = new URL(href, url).toString();
    airports.push({ icao, title: title, url: fullUrl, type, country: 'NL' } as Airport);
  }
  return airports;
}

export async function crawl_nl() {
  // Start at the LVNL main page
  let response = await fetch(rootUrl);
  let $ = cheerio.load(await response.text());
  const eaipUrl = $('a:contains("eAIP")').attr('href');
  if (!eaipUrl) {
    throw new Error(`Could not find the "eAIP" link button in ${rootUrl}`);
  }
  // Go to the eAIP page
  response = await fetch(eaipUrl);
  $ = cheerio.load(await response.text());
  let href = $('frame[name="eAISMenuContentFrame"]').attr('src');
  if (!href) {
    throw new Error(`Could not find the "eAISMenuContentFrame" frame in ${eaipUrl}`);
  }
  // Go to the eAISMenuContentFrame
  let url = new URL(href, eaipUrl).toString();
  response = await fetch(url);
  $ = cheerio.load(await response.text());
  href = $('frame[name="eAISMenuFrameset"]').attr('src');
  if (!href) {
    throw new Error(`Could not find the "eAISMenuFrameset" frame in ${url}`);
  }
  // Go to the eAISMenuFrameset
  url = new URL(href, url).toString();
  response = await fetch(url);
  $ = cheerio.load(await response.text());
  href = $('frame[name="eAISMenuContent"]').attr('src');
  if (!href) {
    throw new Error(`Could not find the "eAISMenuContent" frame in ${url}`);
  }
  // Go to the eAISMenuContent
  url = new URL(href, url).toString();
  response = await fetch(url);
  $ = cheerio.load(await response.text());
  // Extract VFR airports
  const airportsList = extractAirports($, '#AD-2details>.Hx', url, 'vfr');
  airportsList.push(...extractAirports($, '#AD-3details>.Hx', url, 'heliport'));
  
  await db.delete(airports).where(eq(airports.country, 'NL')).execute();
  await db.insert(airports).values(airportsList).execute();
  return airportsList;
}