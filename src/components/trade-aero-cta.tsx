import { ExternalLinkIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";
import { tradeAeroUrl } from "~/lib/trade-aero";

/**
 * Localized, country-targeted cross-sell to the sister marketplace Trade:Aero.
 * Server-rendered (SSR): the copy comes from the `TradeAero` message namespace
 * (per-locale, so it names the country in the visitor's language) and the link is
 * derived from the locale via `tradeAeroUrl`. Because the i18n parity check
 * enforces the `TradeAero` keys in every locale file, a newly added country
 * cannot ship without this CTA — it rolls out automatically.
 */
export async function TradeAeroCta() {
  const t = await getTranslations("TradeAero");
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mt-16 flex flex-col items-center justify-center gap-3 border border-[#ccc] bg-white p-6 text-center">
        <h2 className="!text-[1.125rem] font-medium">{t("title")}</h2>
        <p>{t("description")}</p>
        <ExternalLink
          href={tradeAeroUrl(locale)}
          hrefTitle={t("buttonHrefTitle")}
          rel="noopener"
          className="bg-drossblue hover:bg-drossblue-light mt-2 inline-flex items-center gap-x-2 px-4 py-2 text-white"
        >
          <span>{t("buttonTitle")}</span>
          <ExternalLinkIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />
        </ExternalLink>
      </div>
    </div>
  );
}
