import { NextResponse } from "next/server";
import { getPathname } from "~/i18n/routing";
import type { Airport } from "~/server/db/schema";
import {
  countryTypeAvailability,
  countryMeta,
  liveCountries,
  orgUrl,
} from "~/lib/utils";

// llms.txt (https://llmstxt.org/): a curated, LLM-friendly site summary in
// Markdown, served at the spec's well-known path. Generated entirely from the
// country config (liveCountries x countryMeta x countryTypeAvailability), so
// launching a country updates it automatically - same principle as the
// sitemap. Purely static (no DB), prerendered at build time.
export const dynamic = "force-static";

const TYPE_LABELS: Record<Airport["type"], string> = {
  vfr: "VFR airfields",
  ifr: "IFR airports",
  heliport: "heliports",
  mil: "military aerodromes",
  aeroport: "aeroports",
};

/** "a, b and c" - English list join for the per-country descriptions. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " and " + items.at(-1);
}

export function GET() {
  const countries = liveCountries
    .map((cc) => ({ cc, meta: countryMeta[cc]! }))
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name));

  const countryLines = countries.map(({ cc, meta }) => {
    const types = (countryTypeAvailability[cc] ?? []).map(
      (t) => TYPE_LABELS[t],
    );
    const url = new URL(`/${cc}/`, orgUrl).toString();
    // "the Netherlands" / "the United Kingdom" - names that need an article.
    const ofName = ["Netherlands", "United Kingdom"].includes(meta.name)
      ? `the ${meta.name}`
      : meta.name;
    return `- [${meta.name}](${url}): official AIP of ${ofName} - ${joinList(types)} with approach charts, airport data and weather`;
  });

  // Canonical trailing-slash URLs (trailingSlash: true), same normalization
  // as the EFB page's internal links.
  const localizedUrl = (href: "/efb" | "/airport-list") => {
    const path = getPathname({ href, locale: "uk" });
    return new URL(path.endsWith("/") ? path : path + "/", orgUrl).toString();
  };
  const efbUrl = localizedUrl("/efb");
  const listUrl = localizedUrl("/airport-list");

  const text = `# AIP:Aero

> AIP:Aero simplifies the search for official Aeronautical Information Publications (AIPs), approach charts and airport data for private pilots (VFR and IFR) across ${countries.length} European countries. Every chart link points to the official national AIP publication; airport pages add decoded METAR/TAF weather, runways, frequencies, sunrise/sunset, customs and border-crossing information.

Important notes:

- All aeronautical data is linked from the official national AIP sources, not republished. Always check the official publication before flight.
- Airport detail pages follow the pattern \`https://aip.aero/<country>/<type>/?<ICAO>\` (for example https://aip.aero/de/vfr/?EDDF), where \`<type>\` is one of vfr, ifr, heliports, military or aeroports depending on the country.
- Every country is available in its native language and in English (\`https://aip.aero/<country>/en/\`); the United Kingdom and Belgium & Luxembourg are English-only.
- AIP:Aero is a free installable web app (PWA) with offline country packs - no account needed.

## Countries

${countryLines.join("\n")}

## Guides

- [EFB guide](${efbUrl}): install AIP:Aero on an Electronic Flight Bag, save fields and whole countries offline, import chart PDFs into ForeFlight, SkyDemon and other EFB apps
- [Airport list (UK example)](${listUrl}): every country has a full airport list page with an interactive map and offline download

## Data

- Read-only JSON API for integration partners (shared-key gated): \`GET https://aip.aero/api/v1/airports/{country}\` (a country's aerodrome index) and \`GET https://aip.aero/api/v1/airport/{ICAO}\` (one aerodrome with chart links + facts). Request a key via https://dross.net/contact
- [Full index](${new URL("/llms-full.txt", orgUrl).toString()}): the complete per-country map (all URLs, chart types and official AIP sources) in one file

## About

- [Homepage](${orgUrl.toString()}): country index with all supported AIPs
- [Trade:Aero](https://trade.aero/): sister marketplace for buying and selling aircraft
`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // A day of caching is plenty - content only changes on deploys.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
