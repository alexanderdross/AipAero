import { CircleHelpIcon, FileTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";
import { SectionHeading } from "~/components/section-heading";
import {
  airacDateFromUrl,
  chartDisplayName,
  cleanChartName,
  groupChartsByCategory,
  type ChartLink,
} from "~/lib/charts";
import { localeLangMapping } from "~/i18n/routing";
import { getHubLinks } from "~/lib/hub-links";

/**
 * Chart-PDF box, shown when the airport's chart URL points directly at a PDF
 * (`isPdfUrl` / crawler-captured `pdfUrl`). It lists the charts as plain
 * "open PDF" links - the primary one up top, and every other captured chart
 * (SIDs/STARs/IACs, parking, ...) in a collapsed `<details>` list.
 *
 * No inline PDF preview: an `<object>`/`<embed>` render of a cross-origin AIP
 * PDF is unreliable (many AIP hosts block framing, and mobile browsers do not
 * render PDFs inline at all - it showed an empty box), it only ever previewed
 * ONE chart, and the open links already give access to every PDF. So the box
 * is links-only - honest and reliable.
 *
 * Honest labelling: below the primary open link the box shows the source's OWN
 * designation for that chart (e.g. "AD 2.EGPD-2-1" = aerodrome chart, "ESNX
 * VAC" = visual approach chart) plus the AIRAC/publication date parsed from the
 * URL - chart currency is safety-relevant, and the generic box title must not
 * oversell an aerodrome chart as an approach chart.
 */
export async function AirportChart({
  url,
  charts = [],
  locale,
  fallbackAiracIso = null,
}: {
  url: string;
  charts?: ChartLink[];
  locale: string;
  // Country edition (crawl_meta.airac) used when the chart URL carries no date
  // (e.g. MK's `current` alias), so every chart box can still show the AIRAC.
  fallbackAiracIso?: string | null;
}) {
  const t = await getTranslations("Chart");
  const tFooter = await getTranslations({ locale, namespace: "Footer" });
  const lang = localeLangMapping[locale] ?? "en";
  // Content-hub deep anchors: "AIRAC" -> the AIRAC-cycle guide. The primary
  // chart designation (e.g. "ESNX VAC") links to the chart PDF itself - pilots
  // read it as the chart's name, so it must open the chart, not a definition
  // (owner directive 19.07.2026). The "what does this designator mean?" glossary
  // term (approach-chart-types) sits on a small help icon next to it instead.
  // Reuses the Footer namespace labels.
  const hub = await getHubLinks(locale);

  const primary = charts.find((c) => c.url === url) ?? null;
  const others = charts.filter((c) => c.url !== url);
  const airacIso = airacDateFromUrl(url) ?? fallbackAiracIso;
  const airacLabel = airacIso
    ? new Date(airacIso).toLocaleDateString(locale.replace("-EN", ""))
    : null;
  // The chart's own designation (e.g. "ESNX VAC"); the AIRAC part is rendered
  // separately below so the "AIRAC" word can carry the guides link.
  const designation = primary ? chartDisplayName(primary.name, lang) : null;

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading className="text-center text-xl font-normal">
        {t("title")}
      </SectionHeading>

      <p className="mt-3 text-center text-sm">
        <ExternalLink
          href={url}
          hrefTitle={t("openPdf")}
          className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
        >
          <FileTextIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{t("openPdf")}</span>
        </ExternalLink>
      </p>
      {(designation || airacLabel) && (
        <p className="text-drossgray-dark mt-1 text-center text-xs">
          {designation && (
            <span className="inline-flex items-center gap-x-1">
              <ExternalLink
                href={url}
                hrefTitle={`${cleanChartName(primary!.name)} (PDF)`}
                className="text-drossblue underline"
              >
                {designation}
              </ExternalLink>
              <a
                href={hub.chartsTerm}
                title={tFooter("glossary.hrefTitle")}
                aria-label={tFooter("glossary.hrefTitle")}
                className="text-drossgray-dark hover:text-drossblue inline-flex min-h-6 min-w-6 items-center justify-center align-middle"
              >
                <CircleHelpIcon
                  className="h-3.5 w-3.5 flex-shrink-0"
                  aria-hidden="true"
                />
              </a>
            </span>
          )}
          {designation && airacLabel && " · "}
          {airacLabel && (
            <>
              <a
                href={hub.airacGuide}
                title={tFooter("guides.hrefTitle")}
                className="text-drossblue underline"
              >
                AIRAC
              </a>{" "}
              {airacLabel}
            </>
          )}
        </p>
      )}

      {/* The source's full chart set (collapsed; plain SSR links), grouped by
          flight phase for a mostly-VFR audience: aerodrome -> visual (VFR) ->
          approach -> arrival -> departure -> other (owner directive
          15.07.2026). Each entry keeps the source's own designation - pilots
          know these codes. */}
      {others.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="text-drossblue cursor-pointer text-center hover:underline">
            {t("allCharts", { count: others.length })}
          </summary>
          <div className="mt-2 space-y-3">
            {groupChartsByCategory(others).map(
              ({ category, charts: groupCharts }) => (
                <div key={category}>
                  <h3 className="text-drossgray-dark text-xs font-semibold tracking-wide uppercase">
                    {t(`group.${category}`)}
                  </h3>
                  <ul className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {groupCharts.map((chart) => (
                      <li key={chart.url}>
                        <ExternalLink
                          href={chart.url}
                          hrefTitle={`${cleanChartName(chart.name)} (PDF)`}
                          className="text-drossblue block py-1.5 break-words hover:underline"
                        >
                          {chartDisplayName(chart.name, lang)}
                        </ExternalLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </details>
      )}
    </section>
  );
}
