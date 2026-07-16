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

/** Codes with a `cc:` tag in the Terms-page AIP_SOURCES attribution list. */
function codesFromTermsSources() {
  const set = new Set();
  for (const m of read("src/app/[locale]/terms/page.tsx").matchAll(
    /cc:\s*"([a-z]{2})"/g,
  ))
    set.add(m[1]);
  return set;
}

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
