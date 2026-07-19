import { describe, expect, it } from "vitest";
import { buildHubAnchors } from "~/lib/hub-anchors";

describe("buildHubAnchors", () => {
  it("deep-anchors the acronym links to the slugified term / guide headings", () => {
    const a = buildHubAnchors({
      glossaryPath: "/uk/glossary/",
      guidesPath: "/uk/guides/",
      aipTermName: "AIP (Aeronautical Information Publication)",
      airacGuideTitle: "Understanding the AIRAC cycle",
      chartsTermName: "Approach chart types",
    });
    // Page tops are the plain trailing-slashed paths.
    expect(a.glossaryTop).toBe("/uk/glossary/");
    expect(a.guidesTop).toBe("/uk/guides/");
    // Acronym links carry the section anchor = slugify(heading). These MUST
    // match the id SectionHeading renders on the hub pages (same slugify + key).
    expect(a.aipTerm).toBe(
      "/uk/glossary/#aip-aeronautical-information-publication",
    );
    expect(a.airacGuide).toBe("/uk/guides/#understanding-the-airac-cycle");
    expect(a.chartsTerm).toBe("/uk/glossary/#approach-chart-types");
  });

  it("strips diacritics in the anchor like the page headings do (localized)", () => {
    const a = buildHubAnchors({
      glossaryPath: "/de/glossary/",
      guidesPath: "/de/guides/",
      aipTermName: "AIP (Luftfahrthandbuch)",
      airacGuideTitle: "Den AIRAC-Zyklus verstehen",
      chartsTermName: "Anflugkarten-Typen",
    });
    expect(a.aipTerm).toBe("/de/glossary/#aip-luftfahrthandbuch");
    expect(a.airacGuide).toBe("/de/guides/#den-airac-zyklus-verstehen");
    // Umlaut folds to plain ascii (NFKD strip), matching slugify on the heading.
    expect(a.chartsTerm).toBe("/de/glossary/#anflugkarten-typen");
  });
});
