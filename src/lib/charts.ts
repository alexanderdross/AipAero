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
