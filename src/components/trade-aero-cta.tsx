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
 * cannot ship without this CTA - it rolls out automatically.
 */
export async function TradeAeroCta() {
  const t = await getTranslations("TradeAero");
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="border-drossblue/20 bg-drossblue/5 mt-12 flex flex-col items-center gap-4 rounded-xl border p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-drossblue font-medium">{t("title")}</p>
        <ExternalLink
          href={tradeAeroUrl(locale)}
          hrefTitle={t("buttonHrefTitle")}
          rel="noopener"
          className="bg-drossblue hover:bg-drossblue-light focus-visible:ring-drossblue inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium whitespace-nowrap text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span>{t("buttonTitle")}</span>
          <ExternalLinkIcon
            className="size-4 flex-shrink-0"
            aria-hidden="true"
          />
        </ExternalLink>
      </div>
    </div>
  );
}
