import { test, expect } from "@playwright/test";
import { XMLParser } from "fast-xml-parser";

// Structural validation of the multilingual XML sitemaps. Airport `?ICAO`
// detail URLs are the highest-value SEO pages, so the sitemap wiring (index →
// per-country sitemap → localized page URLs with hreflang alternates) must
// stay intact. Airport rows need a live DB, so under `next start` we assert
// the always-present page entries + alternate-language structure.
const parser = new XMLParser({ ignoreAttributes: false });
const ORIGIN = "https://aip.aero";

test("sitemap index lists one sitemap per country", async ({ request }) => {
  const res = await request.get("/2d6a9a/sitemap.xml");
  expect(res.status()).toBe(200);
  const body = await res.text();

  // Well-formed XML (parser throws on malformed input).
  const doc = parser.parse(body);
  expect(doc.sitemapindex).toBeTruthy();

  for (const c of ["at", "de", "fr", "nl", "uk"]) {
    expect(body).toContain(`${ORIGIN}/2d6a9a/sitemap/${c}.xml`);
  }
});

test("per-country sitemap has localized page URLs with hreflang alternates", async ({
  request,
}) => {
  const res = await request.get("/2d6a9a/sitemap/de.xml");
  expect(res.status()).toBe(200);
  const body = await res.text();

  const doc = parser.parse(body);
  expect(doc.urlset).toBeTruthy();

  // Every applicable page type for Germany, trailing-slashed.
  for (const path of [
    "/de/",
    "/de/vfr/",
    "/de/ifr/",
    "/de/heliports/",
    "/de/flughafen-liste-deutschland/",
  ]) {
    expect(body, `sitemap missing ${path}`).toContain(`${ORIGIN}${path}`);
  }

  // Alternate-language links for the native + English locale.
  expect(body).toContain('hreflang="de"');
  expect(body).toContain('hreflang="en"');
  expect(body).toContain(`${ORIGIN}/de/en/airport-list-germany/`);
});
