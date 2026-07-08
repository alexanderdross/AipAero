import { getLocale, getTranslations } from "next-intl/server";
import { localeLangMapping } from "~/i18n/routing";
import { modifiedDate } from "~/lib/build-info";

/**
 * "Last updated" trust indicator for the charts index. Server-rendered from the
 * build stamp (`~/lib/build-info`), formatted in the visitor's language.
 */
export async function LastUpdated() {
  const t = await getTranslations("Common");
  const locale = await getLocale();
  const lang = localeLangMapping[locale] ?? "en";
  const date = new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(modifiedDate));

  return (
    <p className="text-drossgray-dark mt-2 text-center text-sm">
      {t("lastUpdated")}: {date}
    </p>
  );
}
