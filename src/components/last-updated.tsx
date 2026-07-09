import { getLocale, getTranslations } from "next-intl/server";
import { localeLangMapping } from "~/i18n/routing";
import { modifiedDate } from "~/lib/build-info";

/**
 * "Last updated" trust indicator for the charts index. Prefers the real
 * per-country crawl timestamp (`timestamp`, unix seconds) when available, else
 * falls back to the build stamp (`~/lib/build-info`). Formatted in the visitor's
 * language, server-rendered.
 */
export async function LastUpdated({
  timestamp,
}: {
  timestamp?: number | null;
}) {
  const t = await getTranslations("Common");
  const locale = await getLocale();
  const lang = localeLangMapping[locale] ?? "en";
  const date = new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(
    timestamp != null ? new Date(timestamp * 1000) : new Date(modifiedDate),
  );

  return (
    <p className="text-drossgray-dark mt-2 text-center text-sm">
      {t("lastUpdated")}: {date}
    </p>
  );
}
