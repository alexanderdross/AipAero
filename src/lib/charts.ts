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
  // UK/NO: .../2026-07-09-AIRAC/...
  {
    rx: /(\d{4})-(\d{2})-(\d{2})-AIRAC/i,
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
 * Only unambiguous ICAO designators are listed. A code that is not a standard
 * designation (e.g. a state-specific "PDC") is deliberately absent, so an
 * unknown chart keeps its raw code rather than getting a wrong, potentially
 * misleading full name - chart labelling is safety-relevant.
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
  for (const token of name.split(CHART_TOKEN_SPLIT)) {
    const entry = CHART_TYPES[token.toUpperCase()];
    if (entry) return entry[lang] ?? entry.en;
  }
  return null;
}
