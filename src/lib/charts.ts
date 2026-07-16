/**
 * Chart-list helpers for the crawler-captured `airports.charts` column (JSON
 * array of {name, url} - the source's own chart designations, see
 * docs/chart-pdf-plan.md) and for deriving the AIRAC effective date from the
 * edition-specific chart URLs. Pure functions, unit-tested in charts.test.ts.
 */

export interface ChartLink {
  name: string;
  url: string;
}

/** Parse the stored JSON chart list; malformed/absent input returns []. */
export function parseCharts(raw: string | null | undefined): ChartLink[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (c): c is ChartLink =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as ChartLink).name === "string" &&
        typeof (c as ChartLink).url === "string",
    );
  } catch {
    return [];
  }
}

// Every source embeds its AIRAC edition in the chart/page URLs - each in its
// own format. Ordered: the more specific patterns first.
const AIRAC_PATTERNS: {
  rx: RegExp;
  toIso: (m: RegExpMatchArray) => string;
}[] = [
  // UK/NO/BA: .../2026-07-09-AIRAC/...  and AL: .../2026-05-20-NON-AIRAC/...
  // (AL publishes both AIRAC and off-cycle NON-AIRAC editions; the date is the
  // effective date either way, so the "NON-" is optional).
  {
    rx: /(\d{4})-(\d{2})-(\d{2})-(?:NON-)?AIRAC/i,
    toIso: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
  // FR: .../AIRAC-2026-07-09/...
  {
    rx: /AIRAC-(\d{4})-(\d{2})-(\d{2})/i,
    toIso: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
  // NL/SE/PL edition folders: ..._2026_07_09/...
  {
    rx: /_(\d{4})_(\d{2})_(\d{2})[/\\]/,
    toIso: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
  // AT: https://eaip.austrocontrol.at/lo/260710/... (yymmdd)
  {
    rx: /\/lo\/(\d{2})(\d{2})(\d{2})\//i,
    toIso: (m) => `20${m[1]}-${m[2]}-${m[3]}`,
  },
  // DE: https://aip.dfs.de/BasicVFR/2026JUN25/... (edition, not AIRAC-dated,
  // but still the publication date of the linked page).
  {
    rx: /\/(\d{4})([A-Z]{3})(\d{2})\//,
    toIso: (m) => {
      const months: Record<string, string> = {
        JAN: "01",
        FEB: "02",
        MAR: "03",
        APR: "04",
        MAY: "05",
        JUN: "06",
        JUL: "07",
        AUG: "08",
        SEP: "09",
        OCT: "10",
        NOV: "11",
        DEC: "12",
      };
      const month = months[m[2]!];
      return month ? `${m[1]}-${month}-${m[3]}` : "";
    },
  },
  // GR: https://aisgr.hasp.gov.gr/aipgr_incl_amdt_0626_wef_09jul2026/... - the
  // HASP edition folder carries the effective date as `wef_<dd><mmm><yyyy>`.
  {
    rx: /_wef_(\d{2})([a-z]{3})(\d{4})/i,
    toIso: (m) => {
      const months: Record<string, string> = {
        jan: "01",
        feb: "02",
        mar: "03",
        apr: "04",
        may: "05",
        jun: "06",
        jul: "07",
        aug: "08",
        sep: "09",
        oct: "10",
        nov: "11",
        dec: "12",
      };
      const month = months[m[2]!.toLowerCase()];
      return month ? `${m[3]}-${month}-${m[1]}` : "";
    },
  },
  // Generic dated edition folder `/YYYY-MM-DD/` (RO: .../aip/2026-07-09/DOCS/...).
  // LAST + most general so the specific `-AIRAC` / `AIRAC-` / `_YYYY_MM_DD_`
  // forms above win first; only a bare slash-delimited ISO date reaches here.
  {
    rx: /\/(\d{4})-(\d{2})-(\d{2})\//,
    toIso: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
];

/**
 * The AIRAC/publication effective date embedded in an AIP chart URL, as an
 * ISO date string ("2026-07-09"), or null when the URL carries none. Shown
 * next to the chart link (chart currency is safety-relevant for pilots) and
 * fed into the DigitalDocument `datePublished`.
 */
export function airacDateFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  for (const { rx, toIso } of AIRAC_PATTERNS) {
    const m = url.match(rx);
    if (m) {
      const iso = toIso(m);
      if (iso && !Number.isNaN(Date.parse(iso))) return iso;
    }
  }
  return null;
}

/**
 * Glossary of the standard ICAO Annex 4 aerodrome chart-type designators that
 * the sources use as chart names ("IAC 7", "AOC 1", ...). Kept in code, not
 * the i18n JSON - it is a fixed, standard aeronautical vocabulary, not site
 * copy (same rationale as the METAR glossary in metar-decode.ts). Populated
 * for en/de/fr/nl with an English fallback for the other locales.
 *
 * A code is only listed once its meaning is verified - either an unambiguous
 * ICAO designator, or a state code confirmed against the source's own chart
 * (e.g. ENAIRE's "PDC"/"TRAN", read from the chart title inside AD 2-LEBL:
 * "Plano de Estacionamiento y Atraque de Aeronaves" = Aircraft Parking/Docking,
 * "Carta de Transición a la Aproximación" = Approach Transition). A code whose
 * meaning is genuinely ambiguous or unverified stays absent, so an unknown
 * chart keeps its raw code rather than getting a wrong, potentially misleading
 * full name - chart labelling is safety-relevant.
 */
const CHART_TYPES: Record<
  string,
  Partial<Record<string, string>> & { en: string }
> = {
  ADC: {
    en: "Aerodrome Chart",
    de: "Flugplatzkarte",
    fr: "Carte d'aérodrome",
    nl: "Vliegveldkaart",
  },
  AOC: {
    en: "Aerodrome Obstacle Chart",
    de: "Flugplatz-Hinderniskarte",
    fr: "Carte d'obstacles d'aérodrome",
    nl: "Vliegveldobstakelkaart",
  },
  APDC: {
    en: "Aircraft Parking / Docking Chart",
    de: "Luftfahrzeug-Parkkarte",
    fr: "Carte de stationnement des aéronefs",
    nl: "Vliegtuigparkeerkaart",
  },
  // ENAIRE (ES) spells this "Plano de Estacionamiento y Atraque de Aeronaves -
  // OACI" (AD 2-LEBL PDC) - the ICAO Aircraft Parking/Docking Chart, so it
  // shares APDC's labels. Only a chart-list entry ever carries this code, so
  // the datalink "Pre-Departure Clearance" reading does not apply here.
  PDC: {
    en: "Aircraft Parking / Docking Chart",
    de: "Luftfahrzeug-Parkkarte",
    fr: "Carte de stationnement des aéronefs",
    nl: "Vliegtuigparkeerkaart",
  },
  GMC: {
    en: "Ground Movement Chart",
    de: "Rollwegekarte",
    fr: "Carte de circulation au sol",
    nl: "Grondbewegingskaart",
  },
  PATC: {
    en: "Precision Approach Terrain Chart",
    de: "Geländekarte für Präzisionsanflug",
    fr: "Carte de terrain d'approche de précision",
    nl: "Terreinkaart precisienadering",
  },
  SID: {
    en: "Standard Instrument Departure",
    de: "Standard-Instrumentenabflug",
    fr: "Départ normalisé aux instruments",
    nl: "Standaardvertrek volgens instrumenten",
  },
  STAR: {
    en: "Standard Instrument Arrival",
    de: "Standard-Instrumentenankunft",
    fr: "Arrivée normalisée aux instruments",
    nl: "Standaardaankomst volgens instrumenten",
  },
  IAC: {
    en: "Instrument Approach Chart",
    de: "Instrumentenanflugkarte",
    fr: "Carte d'approche aux instruments",
    nl: "Instrumentnaderingskaart",
  },
  VAC: {
    en: "Visual Approach Chart",
    de: "Sichtanflugkarte",
    fr: "Carte d'approche à vue",
    nl: "Zichtnaderingskaart",
  },
  // ENAIRE (ES) "Carta de Transición a la Aproximación (Final)" (AD 2-LEBL
  // TRAN) - the transition from the arrival onto the final approach.
  TRAN: {
    en: "Approach Transition Chart",
    de: "Anflug-Übergangskarte",
    fr: "Carte de transition d'approche",
    nl: "Naderingstransitiekaart",
  },
  VFR: {
    en: "VFR Chart",
    de: "VFR-Karte",
    fr: "Carte VFR",
    nl: "VFR-kaart",
  },
  LDG: {
    en: "Landing Chart",
    de: "Landekarte",
    fr: "Carte d'atterrissage",
    nl: "Landingskaart",
  },
};

// Split a chart name into its whitespace/underscore/hyphen/dot tokens so a
// designator can be matched as a WHOLE token ("VAC" in "ESNX VAC", "VFR" in
// "BIKF_8_VFR_RWY_01") without matching a substring of an unrelated word.
const CHART_TOKEN_SPLIT = /[\s_.\-/]+/;

/**
 * Some sources put the chart's relative href (or bare filename) as the link
 * text, so the stored `name` can be a URL fragment like
 * "../graphics/eAIP/EBAW_ADC01_v48.pdf" (BE/PT/SI/HU). Strip any leading path
 * segments and a trailing ".pdf" so the box shows a readable code instead of a
 * path.
 *
 * Only paths/filenames (which never contain whitespace) are cleaned: a human
 * designation with an internal slash - e.g. the RS "AD 2 LYBE 2.1-1/2 AERODROME
 * CHART" where "1/2" means sheet 1 of 2 - has spaces and is left untouched, so
 * we never mistake its "/" for a path separator. Clean names ("ADC 1", "ESNX
 * VAC", "AD 2-LKTB-2-1") also pass through unchanged.
 */
export function cleanChartName(name: string): string {
  const trimmed = name.trim();
  // Whitespace => a human designation, not a path/filename: leave it as-is.
  if (/\s/.test(trimmed)) return trimmed;
  let out = trimmed;
  const slash = out.lastIndexOf("/");
  if (slash !== -1) out = out.slice(slash + 1);
  if (/\.pdf$/i.test(out)) out = out.slice(0, -4);
  return out || trimmed;
}

/**
 * The full, localized name of the chart type encoded in a chart designation
 * ("IAC 7" -> "Instrument Approach Chart"), or null when the name carries no
 * known standard designator. Pure; used to enrich the raw code shown to the
 * user with its plain-language meaning while keeping the code itself visible.
 */
export function chartTypeLabel(
  name: string | null | undefined,
  lang: string,
): string | null {
  if (!name) return null;
  for (const token of cleanChartName(name).split(CHART_TOKEN_SPLIT)) {
    // Match the token, and also the token with any trailing digits removed so a
    // designator glued to its number ("ADC01", "VAC1", "SID12") still resolves.
    const key = token.toUpperCase().replace(/\d+$/, "");
    const entry = CHART_TYPES[key];
    if (entry) return entry[lang] ?? entry.en;
  }
  return null;
}

/**
 * The chart's raw source code plus its plain-language meaning when the code is
 * a known standard designator, e.g. "IAC 7 -> IAC 7 - Instrument Approach
 * Chart"; just the raw code otherwise. Keeps the pilot-recognised code
 * scannable while spelling it out for everyone else. Shared by the visible
 * chart box and the DigitalDocument JSON-LD so both read identically.
 */
export function chartDisplayName(name: string, lang: string): string {
  const clean = cleanChartName(name);
  const full = chartTypeLabel(name, lang);
  return full ? `${clean} - ${full}` : clean;
}

/**
 * The most common AIRAC/edition date across a set of airports, parsed from
 * their edition-dated chart/page URLs (`pdfUrl` preferred, else `url`). All of
 * a country's charts share one edition, so the mode is that country's effective
 * date; null when no URL carries a parseable date (e.g. CZ). Structural input
 * (no DB dependency) so it stays pure and unit-testable; the crawler-ingest
 * mutation stamps the result into `crawl_meta.airac`.
 */
export function mostCommonAirac(
  airports: { url: string; pdfUrl?: string | null }[],
): string | null {
  const counts = new Map<string, number>();
  for (const a of airports) {
    const iso = airacDateFromUrl(a.pdfUrl ?? a.url);
    if (iso) counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [iso, n] of counts) {
    if (n > bestN) {
      best = iso;
      bestN = n;
    }
  }
  return best;
}

/**
 * Flight-phase category a chart belongs to, used to GROUP the "all charts" list
 * on the detail page instead of leaving it in raw source order. Ordered for a
 * mostly-VFR private-pilot audience: aerodrome layout first, then the visual
 * (VFR) charts, then the IFR procedures (approach / arrival / departure), with
 * anything unrecognised last (owner directive 15.07.2026).
 */
export type ChartCategory =
  | "aerodrome"
  | "visual"
  | "approach"
  | "arrival"
  | "departure"
  | "other";

// Which category each known designator falls under. Membership mirrors the
// CHART_TYPES glossary; a code absent here (or an unrecognised name) is "other".
const CHART_CATEGORY_BY_TYPE: Record<string, ChartCategory> = {
  ADC: "aerodrome",
  AOC: "aerodrome",
  APDC: "aerodrome",
  PDC: "aerodrome",
  GMC: "aerodrome",
  VAC: "visual",
  VFR: "visual",
  IAC: "approach",
  TRAN: "approach",
  PATC: "approach",
  LDG: "approach",
  STAR: "arrival",
  SID: "departure",
};

// Display order of the groups (see the ChartCategory doc). "other" always last.
export const CHART_CATEGORY_ORDER: ChartCategory[] = [
  "aerodrome",
  "visual",
  "approach",
  "arrival",
  "departure",
  "other",
];

/**
 * The flight-phase category of a chart, from its designator token (same token
 * matching as chartTypeLabel: "ADC 1" -> aerodrome, "SID 12" -> departure).
 * Unrecognised names return "other" so nothing is ever dropped.
 */
export function chartCategory(name: string | null | undefined): ChartCategory {
  if (!name) return "other";
  for (const token of cleanChartName(name).split(CHART_TOKEN_SPLIT)) {
    const key = token.toUpperCase().replace(/\d+$/, "");
    const cat = CHART_CATEGORY_BY_TYPE[key];
    if (cat) return cat;
  }
  return "other";
}

/**
 * Group a chart list into the fixed CHART_CATEGORY_ORDER, preserving the
 * source order WITHIN each group (the sources already number their charts).
 * Only non-empty groups are returned, so the caller renders a heading only
 * when that phase has charts. Pure; used by the chart box.
 */
export function groupChartsByCategory(
  charts: ChartLink[],
): { category: ChartCategory; charts: ChartLink[] }[] {
  const buckets = new Map<ChartCategory, ChartLink[]>();
  for (const chart of charts) {
    const cat = chartCategory(chart.name);
    const bucket = buckets.get(cat);
    if (bucket) bucket.push(chart);
    else buckets.set(cat, [chart]);
  }
  return CHART_CATEGORY_ORDER.filter((cat) => buckets.has(cat)).map((cat) => ({
    category: cat,
    charts: buckets.get(cat)!,
  }));
}
