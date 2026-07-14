import { FileTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";
import { SectionHeading } from "~/components/section-heading";
import {
  airacDateFromUrl,
  chartDisplayName,
  type ChartLink,
} from "~/lib/charts";
import { localeLangMapping } from "~/i18n/routing";

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
}: {
  url: string;
  charts?: ChartLink[];
  locale: string;
}) {
  const t = await getTranslations("Chart");
  const lang = localeLangMapping[locale] ?? "en";

  const primary = charts.find((c) => c.url === url) ?? null;
  const others = charts.filter((c) => c.url !== url);
  const airacIso = airacDateFromUrl(url);
  const airacLabel = airacIso
    ? new Date(airacIso).toLocaleDateString(locale.replace("-EN", ""))
    : null;
  const designationLine = [
    primary && chartDisplayName(primary.name, lang),
    airacLabel && `AIRAC ${airacLabel}`,
  ]
    .filter(Boolean)
    .join(" · ");

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
      {designationLine && (
        <p className="text-drossgray-dark mt-1 text-center text-xs">
          {designationLine}
        </p>
      )}

      {/* The source's full chart set (collapsed; plain SSR links). Each entry
          keeps the source's own designation - pilots know these codes. */}
      {others.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="text-drossblue cursor-pointer text-center hover:underline">
            {t("allCharts", { count: others.length })}
          </summary>
          <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {others.map((chart) => (
              <li key={chart.url}>
                <ExternalLink
                  href={chart.url}
                  hrefTitle={`${chart.name} (PDF)`}
                  className="text-drossblue break-words hover:underline"
                >
                  {chartDisplayName(chart.name, lang)}
                </ExternalLink>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
