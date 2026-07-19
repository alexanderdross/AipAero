import { getTranslations } from "next-intl/server";
import { getPathname } from "~/i18n/routing";
import { buildHubAnchors } from "~/lib/hub-anchors";

/**
 * Content-hub link targets for the deep interlinking on the detail and landing
 * pages. Server-only (reads the `GlossaryPage` / `GuidesPage` namespaces, which
 * exist in every locale). One call per page; the glossary/guides labels are
 * cheap. The deep-anchor scheme lives in the pure `buildHubAnchors`.
 */
export async function getHubLinks(locale: string) {
  const [tGlossary, tGuides] = await Promise.all([
    getTranslations({ locale, namespace: "GlossaryPage" }),
    getTranslations({ locale, namespace: "GuidesPage" }),
  ]);
  const withSlash = (p: string) => (p.endsWith("/") ? p : p + "/");
  return buildHubAnchors({
    glossaryPath: withSlash(getPathname({ href: "/glossary", locale })),
    guidesPath: withSlash(getPathname({ href: "/guides", locale })),
    aipTermName: tGlossary("terms.aip.name"),
    airacGuideTitle: tGuides("guides.airac.title"),
    chartsTermName: tGlossary("terms.charts.name"),
  });
}
