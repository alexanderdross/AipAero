import { slugify } from "~/components/section-heading";

/**
 * Pure builder for the content-hub link targets, split out of `getHubLinks`
 * (which needs the next-intl runtime) so the deep-anchor construction is
 * unit-testable in isolation. The acronym links jump to a SPECIFIC term / guide
 * section, whose anchor is `slugify(localized heading)` - the exact id
 * `SectionHeading` renders on the glossary and guides pages (and the
 * DefinedTerm / HowTo `@id`s), so the link lands on the definition, not the page
 * top. Paths must already be trailing-slashed.
 */
export function buildHubAnchors(input: {
  glossaryPath: string;
  guidesPath: string;
  /** Localized name of the "AIP" glossary term. */
  aipTermName: string;
  /** Localized title of the "AIRAC cycle" pilot guide. */
  airacGuideTitle: string;
  /** Localized name of the "approach-chart types" glossary term. */
  chartsTermName: string;
}) {
  return {
    /** Glossary / guides page tops (general "see also" links). */
    glossaryTop: input.glossaryPath,
    guidesTop: input.guidesPath,
    /** "AIP" -> the AIP glossary term. */
    aipTerm: `${input.glossaryPath}#${slugify(input.aipTermName)}`,
    /** "AIRAC" -> the "understanding the AIRAC cycle" pilot guide. */
    airacGuide: `${input.guidesPath}#${slugify(input.airacGuideTitle)}`,
    /** A chart designation -> the approach-chart-types glossary term. */
    chartsTerm: `${input.glossaryPath}#${slugify(input.chartsTermName)}`,
  };
}
