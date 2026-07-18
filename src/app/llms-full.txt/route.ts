import { NextResponse } from "next/server";
import { getPathname, isSingleLocale, type Locale } from "~/i18n/routing";
import type { Airport } from "~/server/db/schema";
import { AIP_SOURCES } from "~/lib/legal";
import {
  countryTypeAvailability,
  countryMeta,
  liveCountries,
  orgUrl,
} from "~/lib/utils";

// llms-full.txt (llmstxt.org): the EXPANDED, one-fetch machine-readable index -
// the curated `/llms.txt` links pages, this inlines the full per-country map
// (all URLs, chart types, the official AIP source) plus the read-only data API,
// so an LLM can ingest the whole coverage in a single request. Generated from
// the country config (launching a country updates it automatically); static,
// no DB, prerendered at build.
export const dynamic = "force-static";

const TYPE_LABELS: Record<Airport["type"], string> = {
  vfr: "VFR airfields",
  ifr: "IFR airports",
  heliport: "heliports",
  mil: "military aerodromes",
  aeroport: "aeroports",
};

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " and " + items.at(-1);
}

/** Absolute, trailing-slashed URL for an internal href in a given locale. */
function url(href: Parameters<typeof getPathname>[0]["href"], locale: Locale) {
  const path = getPathname({ href, locale });
  return new URL(path.endsWith("/") ? path : path + "/", orgUrl).toString();
}

export function GET() {
  const sourceByCc = new Map(AIP_SOURCES.map((s) => [s.cc, s]));

  const countries = liveCountries
    .map((cc) => ({ cc, meta: countryMeta[cc]! }))
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name));

  const countryBlocks = countries.map(({ cc, meta }) => {
    const types = (countryTypeAvailability[cc] ?? []).map(
      (t) => TYPE_LABELS[t],
    );
    const nativeUrl = new URL(`/${cc}/`, orgUrl).toString();
    const englishUrl = new URL(`/${cc}/en/`, orgUrl).toString();
    const listUrl = url("/airport-list", cc as Locale);
    const src = sourceByCc.get(cc);
    const lines = [
      `### ${meta.name}`,
      `- Pages: ${nativeUrl}${isSingleLocale(cc) ? "" : ` (native), ${englishUrl} (English)`}`,
      `- Chart types: ${joinList(types)}`,
      `- Airport list: ${listUrl}`,
    ];
    if (src) lines.push(`- Official AIP source: ${src.name} - ${src.url}`);
    return lines.join("\n");
  });

  const text = `# AIP:Aero - full index

> AIP:Aero simplifies the search for official Aeronautical Information Publications (AIPs), approach charts and airport data for private pilots (VFR and IFR) across ${countries.length} European countries. Every chart link points to the official national AIP publication; airport pages add decoded METAR/TAF weather, runways, frequencies, sunrise/sunset, customs and border-crossing information.

Important notes:

- All aeronautical data is linked from the official national AIP sources, not republished. Always check the official publication before flight.
- Airport detail pages follow the pattern \`https://aip.aero/<country>/<type>/?<ICAO>\` (for example https://aip.aero/de/vfr/?EDDF), where \`<type>\` is one of vfr, ifr, heliports, military or aeroports depending on the country.
- Every country is available in its native language and in English (\`https://aip.aero/<country>/en/\`); the United Kingdom, Belgium & Luxembourg, Ireland and Malta are English-only.
- AIP:Aero is a free installable web app (PWA) with offline country packs - no account needed.

## Data API

AIP:Aero offers a read-only JSON API for EFB / flight-planning integration partners (shared-key gated, request a key via https://dross.net/contact):

- \`GET https://aip.aero/api/v1/airports/{country}\` - a live country's aerodrome index: icao, title, type, slug, url, pdfUrl.
- \`GET https://aip.aero/api/v1/airport/{ICAO}\` - one aerodrome: the AIP/chart links (url, pdfUrl, full captured charts) merged with its facts (coordinates, elevation, runways, frequencies, fuel, opening hours, PPR, customs).

## Countries

${countryBlocks.join("\n\n")}

## Guides

- [EFB guide](${url("/efb", "uk")}): install AIP:Aero on an Electronic Flight Bag, save fields and whole countries offline, import chart PDFs into ForeFlight, SkyDemon and other EFB apps.
- [Aviation glossary](${url("/glossary", "uk")}): plain-language definitions of AIP, eAIP, the AIRAC cycle, VFR/IFR, METAR/TAF, ICAO codes and approach charts.
- [Pilot guides](${url("/guides", "uk")}): how to read an approach chart, how the AIRAC cycle works, and how to decode METAR and TAF weather reports.

## About

- [Homepage](${orgUrl.toString()}): country index with all supported AIPs.
- [Trade:Aero](https://trade.aero/): sister marketplace for buying and selling aircraft.
`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
