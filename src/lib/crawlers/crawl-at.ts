'use server';
import * as cheerio from "cheerio";
import { type InsertAirport } from "~/server/db/schema";
import {slug} from 'github-slugger';
import { MUTATIONS } from "~/server/db/queries";
import { log } from "next-axiom";
import { fetchIso8859 } from "./utils";

const COUNTRY = 'AT';
const rootUrl = 'https://eaip.austrocontrol.at';

async function extractAirports(url: string, type: 'vfr' | 'ifr' | 'heliport') {
  const text = await fetchIso8859(url);
  const $ = cheerio.load(text);
  const tableRows = $('table tr');
  const airports: InsertAirport[] = [];
  for (const row of tableRows) {
    const cells = $(row).find('td');
    if (cells.length < 2) {
      continue;
    }
    const icao = $(cells[0]).find('a').first().text().trim();
    const city = $(cells[1]).text().trim();
    const href = $(cells[0]).find('a').last().attr('href');
    if (!href || icao === 'AD 3') {
      continue;
    }
    // This is either a PDF or a link to another page
    const fullUrl = new URL(href, url).toString();
    if (fullUrl.endsWith('.pdf')) {
      // Just use the PDF link
      airports.push({ 
        icao: icao === '' ? null : icao,
        title: `${city} ${icao}`, 
        url: fullUrl, 
        type, 
        country: COUNTRY,
        slug: icao === '' ? slug(city) : icao
      });
    } else {
      // TODO: Follow link and differentiate between VFR and IFR
      airports.push({ 
        icao: icao === '' ? null : icao,
        title: `${city} ${icao}`, 
        url: fullUrl, 
        type, 
        country: COUNTRY, 
        slug: icao === '' ? slug(city) : icao 
      });
    }
  }
  return airports;
}

export async function crawlAt() {
  // Start at the Austro Control main page
  let response = await fetchIso8859(rootUrl);
  let $ = cheerio.load(response);
  let href = $('a:contains("aktuelle Ausgabe / current version")').attr('href');
  if (!href) {
    log.error(`Could not find the "aktuelle Ausgabe / current version" link in ${rootUrl}`);
    throw new Error(`Could not find the "aktuelle Ausgabe / current version" link in ${rootUrl}`);
  }
  // Go to the current release page
  const mainAipUrl = new URL(href, rootUrl).toString();
  response = await fetchIso8859(mainAipUrl);
  $ = cheerio.load(response);
  href = $('a:contains("Part III - AD")').attr('href');
  if (!href) {
    log.error(`Could not find "Part III - AD" link in ${mainAipUrl}`);
    throw new Error(`Could not find "Part III - AD" link in ${mainAipUrl}`);
  }
  // Go to the Part III - AD page
  const adUrl = new URL(href, mainAipUrl).toString();
  response = await fetchIso8859(adUrl);
  $ = cheerio.load(response);
  const hrefAirports = $('a:contains("AD 2")').attr('href');
  const hrefHeliports = $('a:contains("AD 3")').attr('href');
  if (!hrefAirports || !hrefHeliports) {
    log.error(`Could not find "AD 2" or "AD 3" link in ${adUrl}`);
    throw new Error(`Could not find "AD 2" or "AD 3" link in ${adUrl}`);
  }
  // Go to the AD 2 and AD 3 pages
  const airportsUrl = new URL(hrefAirports, adUrl).toString();
  const heliportsUrl = new URL(hrefHeliports, adUrl).toString();
  const airportsList = await extractAirports(airportsUrl, 'vfr');
  airportsList.push(...await extractAirports(heliportsUrl, 'heliport'));

  if (airportsList.length === 0) {
    log.error(`No ${COUNTRY} airports found`);
    throw new Error(`No ${COUNTRY} airports found`);
  }
  MUTATIONS.insertAirports({ airports: airportsList, country: COUNTRY });
  log.info(`Inserted ${airportsList.length} airports for ${COUNTRY}`);
}