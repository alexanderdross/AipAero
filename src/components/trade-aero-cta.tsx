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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-drossgray-dark text-center text-sm">
        {t("title")}{" "}
        <ExternalLink
          href={tradeAeroUrl(locale)}
          hrefTitle={t("buttonHrefTitle")}
          rel="noopener"
          className="text-drossblue font-medium hover:underline"
        >
          {/* Inline flow (not inline-flex): when the long copy wraps on mobile
              the icon trails the last word instead of floating vertically
              centered at the right edge of the multi-line block. */}
          {t("buttonTitle")}
          <ExternalLinkIcon
            className="ml-1 inline-block size-3.5 align-[-0.125em]"
            aria-hidden="true"
          />
        </ExternalLink>
      </p>
    </div>
  );
}
