#!/usr/bin/env node
// Verify that every locale pair (XX.json ↔ XX-EN.json) shares the exact
// same key set. Catches half-translated PRs before merge — a recurring
// failure mode noted in CLAUDE.md ("update *all* locale files including
// *-EN variants so builds don't break").
//
// `uk.json` has no partner because UK *is* the English locale.

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

process.exit(failed ? 1 : 0);
