#!/usr/bin/env node
// Guard against the recurring "hardcoded list fell behind liveCountries" drift.
//
// Several places keep a per-country list that MUST include every launched
// country but is maintained by hand, so it silently falls behind when a country
// is added (observed twice: the crawl/cd warm-up URL lists, and the Terms-page
// AIP-source attribution which lagged 20 countries). This script derives the
// source of truth (`liveCountries` in src/lib/utils.ts) and asserts each
// derived list covers it. Exit 1 (with the missing codes) if any list drifts.
//
// Run in CI next to the i18n parity check.

import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");

/** The 2-letter codes in the `liveCountries` array (the source of truth). */
function liveCountries() {
  const src = read("src/lib/utils.ts");
  const body = src.match(/liveCountries[^[]*\[([\s\S]*?)\n\];/);
  if (!body)
    throw new Error("liveCountries array not found in src/lib/utils.ts");
  const codes = [...body[1].matchAll(/"([a-z]{2})"/g)].map((m) => m[1]);
  if (codes.length === 0) throw new Error("liveCountries parsed as empty");
  return codes;
}

/** Codes appearing as `/<cc>/` in aip.aero URLs inside a workflow file. */
function codesFromWarmList(path) {
  const set = new Set();
  for (const m of read(path).matchAll(/aip\.aero\/([a-z]{2})\//g))
    set.add(m[1]);
  return set;
}

/** Codes with an English-locale list URL (`/<cc>/en/airport-list-...`) in a
 * workflow file. The English list is a separate prerender that also needs
 * warming - an un-warmed one serves the empty build seed (the it/en list-empty
 * bug, 18.07.2026). */
function enCodesFromWarmList(path) {
  const set = new Set();
  for (const m of read(path).matchAll(
    /aip\.aero\/([a-z]{2})\/en\/airport-list-/g,
  ))
    set.add(m[1]);
  return set;
}

/** Live countries that have an `<cc>-EN` locale (so a distinct English list
 * page that must be warmed). Single-locale countries (uk/be/ie/mt) have none.
 * Derived from routing.ts so a newly added country is classified automatically. */
function twoLocaleLive(live) {
  const routing = read("src/i18n/routing.ts");
  const en = new Set(
    [...routing.matchAll(/"([a-z]{2})-EN":/g)].map((m) => m[1]),
  );
  return live.filter((cc) => en.has(cc));
}

/** Codes with a native country-landing entry in the e2e page matrix. */
function codesFromE2E() {
  const set = new Set();
  // Country landing pages look like `path: "/de/"` (native) - 2 letters only,
  // so `/de/en/` (3+ segments) is naturally excluded; the native entry is proof
  // enough that the country is in the matrix.
  for (const m of read("e2e/pages.ts").matchAll(/path:\s*"\/([a-z]{2})\/"/g))
    set.add(m[1]);
  return set;
}

/** Codes with a `cc:` tag in the shared AIP_SOURCES attribution list (rendered
 * on both terms pages /terms + /agb). */
function codesFromTermsSources() {
  const set = new Set();
  for (const m of read("src/lib/legal.ts").matchAll(/cc:\s*"([a-z]{2})"/g))
    set.add(m[1]);
  return set;
}

/** ISO `iso_country` codes in the OurAirports facts importer's COUNTRIES set
 * (`crawlers/import_ourairports.py`). This list drives which countries get
 * aerodrome facts + map coordinates persisted, so a live country missing here
 * has an EMPTY "airports near me" map. */
function isoCodesFromFactsImporter() {
  const src = read("crawlers/import_ourairports.py");
  const body = src.match(/COUNTRIES\s*=\s*\{([\s\S]*?)\}/);
  if (!body)
    throw new Error("COUNTRIES set not found in crawlers/import_ourairports.py");
  return new Set([...body[1].matchAll(/"([A-Z]{2})"/g)].map((m) => m[1]));
}

/** Map a live locale code to its OurAirports ISO alpha-2 code. Only `uk` -> GB
 * differs; every other live country's ISO code is its locale code uppercased
 * (the BE->LU and RS->ME AIP supersets are extra entries, not required here). */
const isoForLive = (cc) => (cc === "uk" ? "GB" : cc.toUpperCase());

const live = liveCountries();
const checks = [
  [
    "Terms AIP-source attribution (terms/page.tsx AIP_SOURCES)",
    codesFromTermsSources(),
  ],
  ["e2e page matrix country landings (e2e/pages.ts)", codesFromE2E()],
  [
    "crawl.yml warm-up URL list",
    codesFromWarmList(".github/workflows/crawl.yml"),
  ],
  ["cd.yml warm-up URL list", codesFromWarmList(".github/workflows/cd.yml")],
];

// English-locale list warm-up: only the two-locale countries have a distinct
// `/<cc>/en/airport-list-...` page, and each must be warmed alongside its
// native list.
const twoLocale = twoLocaleLive(live);
const enChecks = [
  [
    "crawl.yml English-locale (`/<cc>/en/`) warm-up list",
    enCodesFromWarmList(".github/workflows/crawl.yml"),
  ],
  [
    "cd.yml English-locale (`/<cc>/en/`) warm-up list",
    enCodesFromWarmList(".github/workflows/cd.yml"),
  ],
];

let failed = false;
for (const [label, present] of checks) {
  const missing = live.filter((cc) => !present.has(cc));
  if (missing.length > 0) {
    failed = true;
    console.error(
      `✗ ${label}\n    missing live countries: ${missing.join(", ")}`,
    );
  } else {
    console.log(`✓ ${label} (${live.length} live countries covered)`);
  }
}

for (const [label, present] of enChecks) {
  const missing = twoLocale.filter((cc) => !present.has(cc));
  if (missing.length > 0) {
    failed = true;
    console.error(
      `✗ ${label}\n    missing English-locale list URLs for: ${missing.join(", ")}`,
    );
  } else {
    console.log(
      `✓ ${label} (${twoLocale.length} two-locale countries covered)`,
    );
  }
}

// OurAirports facts importer COUNTRIES (ISO codes) - each live country's ISO
// code must be present or that country ships with an empty map (no persisted
// coordinates). Checked via the locale->ISO mapping (uk->GB, else uppercased).
{
  const label = "OurAirports facts importer COUNTRIES (import_ourairports.py)";
  const iso = isoCodesFromFactsImporter();
  const missing = live.filter((cc) => !iso.has(isoForLive(cc)));
  if (missing.length > 0) {
    failed = true;
    console.error(
      `✗ ${label}\n    missing live countries (ISO): ${missing
        .map((cc) => `${cc}->${isoForLive(cc)}`)
        .join(", ")}`,
    );
  } else {
    console.log(`✓ ${label} (${live.length} live countries covered)`);
  }
}

if (failed) {
  console.error(
    "\nA hardcoded per-country list has fallen behind `liveCountries`. Add the " +
      "missing code(s) to the list(s) above (see each file's KEEP-IN-SYNC note).",
  );
  process.exit(1);
}
console.log(
  `\nAll per-country lists cover every live country (${live.length}).`,
);
