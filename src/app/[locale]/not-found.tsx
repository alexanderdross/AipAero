import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { GlobalSearchInputField } from "~/components/global-search-input-field";
import { getPathname, type Locale } from "~/i18n/routing";

// Rendered when notFound() fires inside the locale tree - most prominently an
// airport-detail URL (/de/vfr/?XYZ) whose slug matches no airport. Instead of
// a dead end, offer the global search: GlobalSearchInputField picks the
// valueless query key off the URL on mount, so the code that just 404ed is
// prefilled and searched right away.
export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("NotFound");
  return (
    <div className="bg-drossgray flex h-full flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-drossgray-dark">{t("description")}</p>
      <div className="w-full max-w-2xl">
        <GlobalSearchInputField placeholder={t("searchPlaceholder")} />
      </div>
      <Link
        href={getPathname({ href: "/", locale })}
        className="text-drossblue underline hover:no-underline"
      >
        {t("home")}
      </Link>
    </div>
  );
}
