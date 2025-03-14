import * as cheerio from 'cheerio';

export async function fetchIso8859(url: string) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("iso-8859-1");
  const decoded = decoder.decode(buffer);
  return decoded;
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