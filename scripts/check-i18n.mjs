#!/usr/bin/env node
// Verify that every locale pair (XX.json ↔ XX-EN.json) shares the exact
// same key set. Catches half-translated PRs before merge — a recurring
// failure mode noted in CLAUDE.md ("update *all* locale files including
// *-EN variants so builds don't break").
//
// `uk.json` has no partner because UK *is* the English locale.

import { parse } from "@formatjs/icu-messageformat-parser";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = new URL("../messages/", import.meta.url).pathname;

function flatten(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatten(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function load(file) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, file), "utf8"));
}

const files = readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));
const pairs = files
  .filter((f) => f.endsWith("-EN.json"))
  .map((en) => [en.replace("-EN.json", ".json"), en])
  .filter(([base]) => files.includes(base));

let failed = false;

for (const [baseFile, enFile] of pairs) {
  const baseKeys = new Set(flatten(load(baseFile)));
  const enKeys = new Set(flatten(load(enFile)));

  const missingInEn = [...baseKeys].filter((k) => !enKeys.has(k)).sort();
  const missingInBase = [...enKeys].filter((k) => !baseKeys.has(k)).sort();

  if (missingInEn.length || missingInBase.length) {
    failed = true;
    console.error(`\n✗ ${baseFile} ↔ ${enFile} key mismatch`);
    if (missingInEn.length) {
      console.error(`  Missing in ${enFile}:`);
      for (const k of missingInEn) console.error(`    - ${k}`);
    }
    if (missingInBase.length) {
      console.error(`  Missing in ${baseFile}:`);
      for (const k of missingInBase) console.error(`    - ${k}`);
    }
  } else {
    console.log(`✓ ${baseFile} ↔ ${enFile}`);
  }
}

// Second check: the BreadCrumbs namespace must carry a {title, hrefTitle}
// entry for every PAGE a country actually renders. The pairwise check above
// can't catch a key missing from BOTH a locale and its -EN partner - which is
// exactly what happens when a country's page availability is EXPANDED (e.g.
// CZ gaining /vfr via its VFR manual, PT gaining /heliports via the eVFR
// manual) without also updating BreadCrumbs. The breadcrumb component looks
// the key up by pathname (`t(`${page.href}.title`)`), so a missing entry is a
// hard runtime MISSING_MESSAGE error on that page for that locale.
const UTILS = new URL("../src/lib/utils.ts", import.meta.url).pathname;
const TYPE_TO_HREF = {
  vfr: "/vfr",
  ifr: "/ifr",
  heliport: "/heliports",
  mil: "/military",
  aeroport: "/aeroports",
};
// Page crumbs rendered on every country (uniform slugs, all locales). NOTE:
// /terms is NOT here anymore - the legal pages (terms/imprint/privacy) are now
// root-level bilingual pages outside `[locale]` and emit their breadcrumb
// directly (not via the BreadCrumbs i18n namespace).
const ALWAYS_PAGES = ["/airport-list", "/efb"];

function loadAvailability() {
  const src = readFileSync(UTILS, "utf8");
  const block = src.match(/countryTypeAvailability[^{]*\{([\s\S]*?)\n\};/)?.[1];
  if (!block) throw new Error("could not parse countryTypeAvailability");
  const avail = {};
  for (const m of block.matchAll(/^\s*([a-z]{2}):\s*\[([^\]]*)\]/gm)) {
    avail[m[1]] = [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]);
  }
  return avail;
}

const availability = loadAvailability();

for (const file of files) {
  const base = file.replace(".json", "");
  const country = base.endsWith("-EN") ? base.slice(0, -3) : base;
  const types = availability[country];
  if (!types) continue; // not a launched/known country locale
  const bc = load(file).BreadCrumbs ?? {};
  const required = [...types.map((t) => TYPE_TO_HREF[t]), ...ALWAYS_PAGES];
  const missing = required.filter((k) => !bc[k]?.title || !bc[k]?.hrefTitle);
  if (missing.length) {
    failed = true;
    console.error(
      `\n✗ ${file}: BreadCrumbs missing page entries (country renders these pages): ${missing.join(", ")}`,
    );
  }
}

// Third check: ICU MessageFormat validity + the apostrophe-before-tag hazard,
// across ALL locale files. next-intl parses every message as ICU MessageFormat;
// a malformed string (unbalanced braces, a plural/select without `other`, a
// broken tag) throws at RENDER time, not build time - invisible until a user
// hits that locale+page. And a straight ASCII apostrophe immediately before a
// markup tag ("L'<glossary>") is an ICU escape that silently swallows the tag
// into a literal quoted region - the FR/IT elision bug that shipped once and was
// fixed with a curly apostrophe. Both are caught here so a translator edit
// cannot reintroduce them. Tags are parsed (ignoreTag:false) to match next-intl.
function flattenValues(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenValues(v, path));
    } else if (typeof v === "string") {
      out.push([path, v]);
    }
  }
  return out;
}

// A straight apostrophe (U+0027), not doubled, right before a markup tag.
const APOS_BEFORE_TAG = /(^|[^'])'<[a-zA-Z]/;

for (const file of files) {
  for (const [key, str] of flattenValues(load(file))) {
    if (APOS_BEFORE_TAG.test(str)) {
      failed = true;
      console.error(
        `\n✗ ${file}: ${key} has a straight apostrophe before a markup tag ('<...>). ICU treats it as an escape and drops the tag - use a curly apostrophe (’) or double it ('').`,
      );
    }
    try {
      parse(str, { ignoreTag: false });
    } catch (e) {
      failed = true;
      console.error(
        `\n✗ ${file}: ${key} is not valid ICU MessageFormat: ${e.message}`,
      );
    }
  }
}

process.exit(failed ? 1 : 0);
