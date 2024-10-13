import * as cheerio from 'cheerio';

export interface Airport {
  icao: string;
  title: string;
  url: string;
  type: 'vfr' | 'ifr' | 'heliport';
  country: string;
}

export async function cheerioFetch(url: string, content: string, selector: string, attr: string) {
  const $ = cheerio.load(content);
  const href = $(selector).attr(attr);
  if (!href) {
    throw new Error(`Could not find "${selector}"`);
  }
  const newUrl = new URL(href, url);
  const response = await fetch(newUrl, { cache: 'no-store' });
  return await response.text();
}