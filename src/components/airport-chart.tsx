import { FileTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ChartPreview } from "~/components/chart-preview";
import { ExternalLink } from "~/components/external-link";
import { SectionHeading } from "~/components/section-heading";
import { airacDateFromUrl, type ChartLink } from "~/lib/charts";

/**
 * Chart-PDF box, shown only when the airport's chart URL points directly at a
 * PDF (`isPdfUrl` / crawler-captured `pdfUrl`). Offers a clear "open PDF" link
 * plus an optional inline preview in a collapsible `<details>`. The preview is
 * best-effort: the browser's native PDF viewer via `<object>`, which is blocked
 * by the host's `X-Frame-Options` on some sources - the `<object>` fallback then
 * shows the open link, so there is never a dead empty box.
 *
 * Honest labelling: below the open link the box shows the source's OWN
 * designation for the primary chart (e.g. "AD 2.EGPD-2-1" = aerodrome chart,
 * "ESNX VAC" = visual approach chart) plus the AIRAC/publication date parsed
 * from the URL - chart currency is safety-relevant, and the generic box title
 * must not oversell an aerodrome chart as an approach chart. When the crawler
 * captured the full chart list, every further chart (SIDs/STARs/IACs...) is
 * available in a collapsed `<details>` list - SSR, zero client JS, no CLS.
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

  const primary = charts.find((c) => c.url === url) ?? null;
  const others = charts.filter((c) => c.url !== url);
  const airacIso = airacDateFromUrl(url);
  const airacLabel = airacIso
    ? new Date(airacIso).toLocaleDateString(locale.replace("-EN", ""))
    : null;
  const designationLine = [primary?.name, airacLabel && `AIRAC ${airacLabel}`]
    .filter(Boolean)
    .join(" · ");

  const openLink = (className: string) => (
    <ExternalLink href={url} hrefTitle={t("openPdf")} className={className}>
      <FileTextIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{t("openPdf")}</span>
    </ExternalLink>
  );

  return (
    <section className="border-drossgray-dark/15 rounded-xl border bg-white p-4 shadow-sm">
      <SectionHeading className="text-center text-xl font-normal">
        {t("title")}
      </SectionHeading>

      <p className="mt-3 text-center text-sm">
        {openLink(
          "text-drossblue inline-flex items-center gap-x-1 hover:underline",
        )}
      </p>
      {designationLine && (
        <p className="text-drossgray-dark mt-1 text-center text-xs">
          {designationLine}
        </p>
      )}

      <ChartPreview
        url={url}
        previewLabel={t("preview")}
        openLabel={t("openPdf")}
      />

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
                  className="text-drossblue break-all hover:underline"
                >
                  {chart.name}
                </ExternalLink>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
