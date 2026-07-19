import { Fragment, type ReactNode } from "react";
import type { Airport } from "~/server/db/schema";

/**
 * A short, server-rendered descriptive paragraph for an airport detail page,
 * composed from the field's OWN data (name, ICAO, town, runway count, chart
 * type, AIRAC edition). It is unique per aerodrome (not boilerplate) - the
 * high-volume detail pages otherwise carry only data widgets and no prose, which
 * is thin for SEO and gives LLMs nothing to cite. Fully i18n (namespace
 * `AirportSummary`); every clause is a self-contained localized sentence, added
 * only when its datum exists, so the paragraph degrades gracefully.
 *
 * The prose also carries two contextual internal links into the content hub
 * (owner directive: internal-linking density): the proper noun "AIP" in the
 * identity sentence links to the glossary, and "AIRAC" in the dated-chart clause
 * links to the pilot guides. Both are language-neutral acronyms wrapped with a
 * markup tag (`<glossary>` / `<guides>`) in every locale file, so the link
 * handlers are supplied here while the wrapped word stays translated. Returns a
 * ReactNode (not a string) so the links render; still pure (takes a translator +
 * the two tag handlers) and unit-testable, and no extra fetch.
 */

/** A next-intl markup tag handler: wraps the tagged chunk in a link. */
type TagFn = (chunks: ReactNode) => ReactNode;

/** The subset of the next-intl translator this helper needs: a plain call for
 * tagless clauses and `.rich` for the two clauses that carry a link tag. Kept
 * minimal so the unit test can pass a fake. */
type SummaryTranslator = {
  (key: string, values?: Record<string, string | number>): string;
  rich(
    key: string,
    values?: Record<string, string | number | TagFn>,
  ): ReactNode;
};

export function buildAirportSummary(
  t: SummaryTranslator,
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
  /** Tag handlers linking the "AIP" / "AIRAC" words into the content hub. */
  links: { glossary: TagFn; guides: TagFn },
): ReactNode {
  const place = input.icao ? `${input.name} (${input.icao})` : input.name;
  const parts: ReactNode[] = [];

  // identity / identityTown carry the `<glossary>AIP</glossary>` tag.
  parts.push(
    input.town
      ? t.rich("identityTown", {
          place,
          town: input.town,
          glossary: links.glossary,
        })
      : t.rich("identity", { place, glossary: links.glossary }),
  );

  if (input.runwayCount > 0) {
    parts.push(t("runways", { count: input.runwayCount }));
  }

  // Localized chart-type token (VFR/IFR stay literal; heliport/military/
  // aeroport are translated per locale) - reads naturally inside the sentence.
  const chartType = t(`chartType.${input.type}`);
  if (input.hasChart) {
    parts.push(
      input.airac
        ? // chartsAirac carries the `<guides>AIRAC</guides>` tag.
          t.rich("chartsAirac", {
            type: chartType,
            airac: input.airac,
            guides: links.guides,
          })
        : t("charts", { type: chartType }),
    );
  } else {
    parts.push(t("noCharts"));
  }

  // Join the clauses with a single space, keeping each a keyed node.
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? " " : null}
      {part}
    </Fragment>
  ));
}
