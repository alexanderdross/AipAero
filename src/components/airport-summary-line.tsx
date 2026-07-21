import { getTranslations } from "next-intl/server";
import {
  buildAirportSummary,
  type AirportSummaryInput,
} from "~/lib/airport-summary";
import { getHubLinks } from "~/lib/hub-links";

/**
 * The per-airport descriptive prose, rendered in the page SHELL (before the
 * Suspense-gated `AirportGadgets`) so it lands in the FIRST HTML flush.
 *
 * This paragraph is the detail page's Largest Contentful Paint element (a
 * text LCP). Rendered inside the streamed gadgets it only painted once every
 * gadget fetch (facts, geocode, weather-station) had resolved - measured as a
 * ~500 ms LCP render delay on top of TTFB. Hoisting it here decouples it from
 * those fetches: it needs only the field's own data + one CHEAP cached D1 facts
 * read (town + runway count, resolved by the caller into `input`) plus cached
 * translations / hub-link labels, so it paints with the H1 and AIP button.
 *
 * It carries the same `mt-24` top clearance the gadgets region used to own (the
 * AIP button above is absolutely positioned); the gadgets region below drops
 * its own `mt-24` now that this element provides it. Pure SSR text in the first
 * flush -> no layout shift.
 */
export async function AirportSummaryLine({
  input,
  locale,
}: {
  input: AirportSummaryInput;
  locale: string;
}) {
  const [tSummary, tFooter, hub] = await Promise.all([
    getTranslations({ locale, namespace: "AirportSummary" }),
    getTranslations({ locale, namespace: "Footer" }),
    getHubLinks(locale),
  ]);
  // Tag handlers for the two content-hub links inside the prose: the
  // `<glossary>AIP</glossary>` acronym jumps to the AIP glossary term,
  // `<guides>AIRAC</guides>` to the AIRAC-cycle guide. Permanent underline
  // (axe link-in-text-block).
  const summaryLinks = {
    glossary: (chunks: React.ReactNode) => (
      <a
        href={hub.aipTerm}
        title={tFooter("glossary.hrefTitle")}
        className="text-drossblue underline"
      >
        {chunks}
      </a>
    ),
    guides: (chunks: React.ReactNode) => (
      <a
        href={hub.airacGuide}
        title={tFooter("guides.hrefTitle")}
        className="text-drossblue underline"
      >
        {chunks}
      </a>
    ),
  };
  const summary = buildAirportSummary(tSummary, input, summaryLinks);
  return (
    <div className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      <p className="text-drossgray-dark mx-auto max-w-3xl text-center text-sm leading-relaxed">
        {summary}
      </p>
    </div>
  );
}
