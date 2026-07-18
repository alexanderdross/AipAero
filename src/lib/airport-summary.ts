import type { Airport } from "~/server/db/schema";

/**
 * A short, server-rendered descriptive paragraph for an airport detail page,
 * composed from the field's OWN data (name, ICAO, town, runway count, chart
 * type, AIRAC edition). It is unique per aerodrome (not boilerplate) - the
 * high-volume detail pages otherwise carry only data widgets and no prose, which
 * is thin for SEO and gives LLMs nothing to cite. Fully i18n (namespace
 * `AirportSummary`); every clause is a self-contained localized sentence, added
 * only when its datum exists, so the paragraph degrades gracefully. Pure (takes
 * a next-intl translator) -> unit-testable and no extra fetch.
 */

/** Chart-type token used in the summary. VFR/IFR are language-neutral; the
 * others read acceptably untranslated inside the localized sentence. */
const CHART_TYPE: Record<Airport["type"], string> = {
  vfr: "VFR",
  ifr: "IFR",
  heliport: "heliport",
  mil: "military",
  aeroport: "aéroport",
};

type SummaryT = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function buildAirportSummary(
  t: SummaryT,
  input: {
    /** Aerodrome name WITHOUT the ICAO (e.g. "Frankfurt"). */
    name: string;
    /** ICAO code, or null for ICAO-less fields. */
    icao: string | null;
    /** Aerodrome page type. */
    type: Airport["type"];
    /** Town / municipality, if known. */
    town: string | null;
    /** Number of runways, if known (0 = omit the runway sentence). */
    runwayCount: number;
    /** Whether a direct chart PDF is linked (vs. an AIP entry only). */
    hasChart: boolean;
    /** Formatted AIRAC edition date, if known. */
    airac: string | null;
  },
): string {
  const place = input.icao ? `${input.name} (${input.icao})` : input.name;
  const parts: string[] = [];

  parts.push(
    input.town
      ? t("identityTown", { place, town: input.town })
      : t("identity", { place }),
  );

  if (input.runwayCount > 0) {
    parts.push(t("runways", { count: input.runwayCount }));
  }

  const chartType = CHART_TYPE[input.type];
  if (input.hasChart) {
    parts.push(
      input.airac
        ? t("chartsAirac", { type: chartType, airac: input.airac })
        : t("charts", { type: chartType }),
    );
  } else {
    parts.push(t("noCharts"));
  }

  return parts.join(" ");
}
