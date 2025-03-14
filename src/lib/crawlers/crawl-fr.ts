'use server';

import * as cheerio from 'cheerio';
import { type InsertAirport } from '~/server/db/schema';
import {slug} from 'github-slugger';
import { MUTATIONS } from '~/server/db/queries';
import { log } from 'next-axiom';
import { fetchIso8859 } from './utils';

const COUNTRY = 'FR';
const rootUrl = 'https://www.sia.aviation-civile.gouv.fr/plandesite';

function extractAirports($: cheerio.CheerioAPI, selector: string, url: string, type: 'vfr' | 'ifr' | 'heliport') {
  const heliportRows = $(selector);
  const airports: InsertAirport[] = [];
  for (const row of heliportRows) {
    const element = $(row).find('a').last();
    const text = element.text().trim();
    const icao = text.split('—')[0]?.trim() ?? '';
    const city = text.split('—')[1]?.trim() ?? '';
    // Find the chart details
    const adDetails = $(row).next().find('a').last();
    const href = adDetails.attr('href');
    if (!href) {
      continue;
    }
    const fullUrl = new URL(href, url).toString();
    airports.push({ 
      icao, 
      title: icao === '' ? city : `${city} ${icao}`, 
      url: fullUrl, 
      type, 
      country: COUNTRY,
      slug: icao === '' ? slug(city) : icao
    });
  }
  return airports;
}

export async function crawlFr() {
  // Start at the Plan du site SIA main page
  let r = await fetch(rootUrl);
  let $ = cheerio.load(await r.text());
  let url = $('a:contains("eAIP FRANCE")').attr('href');
  if (!url) {
    throw new Error(`Could not find the eAIP FRANCE url in ${rootUrl}`);
  }
  
  // Go to eAIP FRANCE 
  let response = await fetchIso8859(url);
  $ = cheerio.load(response);
  url = $('object').attr('data');
  if (!url) {
    throw new Error(`Could not find the Currently Effective eAIP object frame in ${rootUrl}`);
  }
  
  // Go to the Currently Effective eAIP object frame
  response = await fetchIso8859(url);
  $ = cheerio.load(response);
  /*const eaipUrl = $('#dateVig').attr('href');
  if (!eaipUrl) {
    console.log(response)
    throw new Error(`Could not find the "eAIP" link button in ${url}`);
  }*/
  const onLoadValue = $('body').attr('onload');
  // Use regex to extract the parameters from init()
  const regex = /init\('[^']*','(\d{4})','(\d{2})','(\d{2})','\d{2}'\)/;
  const matches = onLoadValue?.match(regex);
  if (!matches) {
    throw new Error(`Could not find the init() function in ${url} body`);
  }
  const [, year, month, day] = matches;
  if (!year || !month || !day) {
    throw new Error(`Could not extract the year, month and day from ${url} body`);
  }
  let href: string | undefined = `AIRAC-${year}-${month}-${day}/html/index-fr-FR.html`;
  const eaipUrl = new URL(href, url).toString()

  // Go to the eAIP page
  response = await fetchIso8859(eaipUrl);
  $ = cheerio.load(response);
  href = $('frame[name="eAISNavigationBase"]').attr('src');
  if (!href) {
    throw new Error(`Could not find the "eAISNavigationBase" frame in ${eaipUrl}`);
  }
  // Go to the eAISNavigationBase
  url = new URL(href, eaipUrl).toString();
  response = await fetchIso8859(url);
  $ = cheerio.load(response);
  href = $('frame[name="eAISNavigation"]').attr('src');
  if (!href) {
    throw new Error(`Could not find the "eAISNavigation" frame in ${url}`);
  }
  // Go to the eAISMenuContent
  url = new URL(href, url).toString();
  response = await fetchIso8859(url);
  $ = cheerio.load(response);
  // Extract VFR airports
  const airportsList = extractAirports($, '#AD-2-IFRdetails>.H3', url, 'ifr');
  airportsList.push(...extractAirports($, '#AD-3details>.H3', url, 'heliport'));
  
  if (airportsList.length === 0) {
    throw new Error(`No ${COUNTRY} airports found`);
  }
  MUTATIONS.insertAirports({ airports: airportsList, country: COUNTRY });
  log.info(`Inserted ${airportsList.length} airports for ${COUNTRY}`);
}