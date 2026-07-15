import { getLocale, getTranslations } from "next-intl/server";
import { localeLangMapping } from "~/i18n/routing";
import { modifiedDate } from "~/lib/build-info";

/**
 * "Last updated" trust indicator for the charts index. Prefers the real
 * per-country crawl timestamp (`timestamp`, unix seconds) when available, else
 * falls back to the build stamp (`~/lib/build-info`). Formatted in the visitor's
 * language, server-rendered.
 *
 * When the country's AIRAC/edition date is known (`airacIso`, stamped at crawl
 * time from the sources' edition-dated URLs), it is appended as an "AIRAC …"
 * line - the data-currency indicator pilots actually reason about, distinct
 * from when we last fetched it. Omitted when null (e.g. CZ, whose URLs carry no
 * date).
 */
export async function LastUpdated({
  timestamp,
  airacIso,
}: {
  timestamp?: number | null;
  airacIso?: string | null;
}) {
  const t = await getTranslations("Common");
  const locale = await getLocale();
  const lang = localeLangMapping[locale] ?? "en";
  const fmt = new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const date = fmt.format(
    timestamp != null ? new Date(timestamp * 1000) : new Date(modifiedDate),
  );
  // AIRAC date: parse the ISO string as a UTC date (no time zone shift).
  const airacDate =
    airacIso && !Number.isNaN(Date.parse(airacIso))
      ? fmt.format(new Date(`${airacIso}T00:00:00Z`))
      : null;

  return (
    <p className="text-drossgray-dark mt-2 text-center text-sm">
      {t("lastUpdated")}: {date}
      {airacDate && (
        <>
          {" · "}
          <span className="whitespace-nowrap">AIRAC {airacDate}</span>
        </>
      )}
    </p>
  );
}
