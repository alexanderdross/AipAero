import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { isSingleLocale } from "~/i18n/routing";
import LocaleSwitcherLinks from "./locale-switcher-links";
import { SchemaWebpage } from "./schemas/schema-webpage";

export default function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();

  const nonEnglish = locale.replace("-EN", "");
  const english = nonEnglish + "-EN";

  // Single-locale countries (uk, be) serve only one language, so there is
  // nothing to switch - render nothing instead of a pointless one-option
  // toggle (which also showed an "Unknown" label for the locale with no
  // partner).
  if (isSingleLocale(locale)) {
    return;
  }

  return (
    <Suspense fallback={null}>
      <SchemaWebpage nonEnglishLocale={nonEnglish} englishLocale={english} />
      <LocaleSwitcherLinks
        label={t("label")}
        options={[
          { locale: nonEnglish, label: t("locale", { locale: nonEnglish }) },
          { locale: english, label: t("locale", { locale: "en" }) },
        ]}
      />
    </Suspense>
  );
}
