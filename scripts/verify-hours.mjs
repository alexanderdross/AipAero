#!/usr/bin/env node
// Post-deploy verification of the operating-hours feature against a LIVE URL.
//
// This is NOT a CI test - the Playwright e2e suite runs against `next start`
// with an ABSENT D1, so `?ICAO` detail pages have no airport rows and cannot
// assert per-field hours (see playwright.config.ts + CLAUDE.md). The CI ground
// truth is the unit layer (opening-hours / hours-overrides / de_hours tests).
// This script is the on-demand deployed-URL check (mirrors lighthouse.yml's
// `base_url` pattern): run it after a deploy against aip.aero (or a preview).
//
// It fetches the DE detail page for a verified-override field (default EDNY),
// tolerantly parses the served HTML + JSON-LD (no jsdom), and asserts:
//   * the Airport JSON-LD carries an `openingHoursSpecification` with the field's
//     verified UTC window for the season active NOW (EDNY Mon-Fri 05:00-21:00 in
//     winter, 04:00-20:00 in summer);
//   * the visible weekday table is labelled "(UTC)" - and NO "LT" frame leaks;
//   * the badge carries the authoritative source label ("laut AIP AD 2.3");
//   * the OCR "machine-read" disclaimer is ABSENT (the override is not OCR).
//
// Usage:
//   node scripts/verify-hours.mjs [--base-url=https://aip.aero] [--icao=EDNY]
//                                 [--path=/de/vfr/]
// Exit 0 = all checks pass; exit 1 = a check failed (prints which).

import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(ROOT + p, "utf8"));

function arg(name, def) {
  const pfx = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pfx));
  return hit ? hit.slice(pfx.length) : def;
}

const BASE = arg("base-url", "https://aip.aero").replace(/\/+$/, "");
const ICAO = arg("icao", "EDNY").toUpperCase();
const PATH = arg("path", "/de/vfr/");
const URL_ = `${BASE}${PATH.replace(/\/?$/, "/")}?${ICAO}`;

// Exact German copy the page renders (source of truth = the message file), so
// the disclaimer/source-label checks never guess at wording.
const de = readJson("messages/de.json").Weather;
const OFFICIAL_LABEL = de.hoursOfficial; // "laut AIP AD 2.3"
const OCR_DISCLAIMER = de.hoursOcrDisclaimer; // the "machine-read" sentence

// --- tolerant JSON-LD extraction ---------------------------------------------

function jsonLdBlocks(html) {
  const out = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore an unparseable block - tolerant by design */
    }
  }
  return out;
}

// Depth-first collect every object that has the given key.
function collectByKey(node, key, acc = []) {
  if (Array.isArray(node)) {
    for (const v of node) collectByKey(v, key, acc);
  } else if (node && typeof node === "object") {
    if (key in node) acc.push(node);
    for (const v of Object.values(node)) collectByKey(v, key, acc);
  }
  return acc;
}

// --- run ----------------------------------------------------------------------

const results = [];
const check = (name, ok, detail = "") =>
  results.push({ name, ok: !!ok, detail });

async function main() {
  let html;
  try {
    const res = await fetch(URL_, {
      headers: { "user-agent": "aip-aero-verify-hours/1.0" },
    });
    check("fetch 200", res.ok, `HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    check("fetch 200", false, String(e));
    return;
  }
  if (!html) return;

  const specs = jsonLdBlocks(html).flatMap((b) =>
    collectByKey(b, "openingHoursSpecification"),
  );
  const allSpecs = specs.flatMap((s) => {
    const v = s.openingHoursSpecification;
    return Array.isArray(v) ? v : v ? [v] : [];
  });
  check(
    "JSON-LD openingHoursSpecification present",
    allSpecs.length > 0,
    `${allSpecs.length} spec(s)`,
  );
  // EDNY publishes a seasonal UTC pair (winter 05:00-21:00Z, summer
  // 04:00-20:00Z). The site shows the season active NOW - determine it the same
  // way the code does (is Europe/Berlin in DST right now?) and assert that pair.
  const berlinDst =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value !== "GMT+01:00";
  const wd = berlinDst
    ? { opens: "04:00", closes: "20:00" }
    : { opens: "05:00", closes: "21:00" };
  const hasWeekday = allSpecs.some(
    (s) => s.opens === wd.opens && s.closes === wd.closes,
  );
  check(
    `JSON-LD weekday window ${wd.opens}-${wd.closes} UTC (${berlinDst ? "summer" : "winter"})`,
    hasWeekday,
    JSON.stringify(allSpecs.map((s) => `${s.opens}-${s.closes}`)),
  );

  // Visible weekday table: UTC label, the active-season window text, and NO LT.
  check("weekday table labelled (UTC)", html.includes("(UTC)"));
  check(
    `weekday table shows ${wd.opens}-${wd.closes}`,
    html.includes(`${wd.opens}-${wd.closes}`),
  );
  check("no LT frame leaked", !/\(LT\)|\d{2}:\d{2}LT/.test(html));

  // Authoritative badge label present, OCR disclaimer absent (eaip override).
  check("authoritative source label present", html.includes(OFFICIAL_LABEL));
  check("OCR disclaimer ABSENT", !html.includes(OCR_DISCLAIMER));
}

await main();

let failed = 0;
console.log(`verify-hours: ${URL_}\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed > 0 ? 1 : 0);
