import { Fragment } from "react";
import { ExternalLink } from "~/components/external-link";
import { getLocale, getTranslations } from "next-intl/server";
import { env } from "~/env";
import { getPathname } from "~/i18n/routing";
import { tradeAeroUrl } from "~/lib/trade-aero";

export default async function Footer() {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const keysTop = ["stratux", "tradeaero"] as const;
  const keysMiddle = [
    "home",
    "imprint",
    "contact",
    "privacy",
    "terms",
  ] as const;

  return (
    <>
      <footer className="mx-auto max-w-7xl overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        {/* Top links */}
        <div className="flex flex-wrap justify-center gap-x-2 px-5 py-2">
          {keysTop.map((key, idx) => {
            // Trade:Aero gets the locale + country aware deep link (and a
            // followed rel so it passes relevance / referrer); the others keep
            // their static i18n href and the default outbound rel.
            const isTrade = key === "tradeaero";
            return (
              <Fragment key={idx}>
                <ExternalLink
                  href={isTrade ? tradeAeroUrl(locale) : t(`${key}.href`)}
                  hrefTitle={t(`${key}.hrefTitle`)}
                  rel={isTrade ? "noopener" : undefined}
                  className="text-drossblue mx-2 text-base hover:underline"
                >
                  {t(`${key}.title`)}
                </ExternalLink>
                {idx < keysTop.length - 1 && "|"}
              </Fragment>
            );
          })}
        </div>

        {/* Middle links */}
        <div className="flex flex-wrap justify-center">
          {keysMiddle.map((key, idx) => (
            <Fragment key={idx}>
              <ExternalLink
                // The terms page is our own localized route, so its href comes
                // from the routing config (getPathname) instead of the i18n
                // files - new locales get the right link automatically.
                href={
                  key === "terms"
                    ? getPathname({ href: "/terms", locale })
                    : t(`${key}.href`)
                }
                hrefTitle={t(`${key}.hrefTitle`)}
                className="text-drossblue mx-2 text-base hover:underline"
              >
                {t(`${key}.title`)}
              </ExternalLink>
              {idx < keysMiddle.length - 1 && "|"}
            </Fragment>
          ))}
        </div>

        {/* Bottom */}
        <p className="text-drossgray-dark mt-2 text-center text-base">
          &copy; {new Date().getFullYear()} made with ♥ by
          <ExternalLink
            href={t("madeBy.href")}
            hrefTitle={t("madeBy.hrefTitle")}
            className="text-drossblue mx-2 text-base italic hover:underline"
          >
            {t("madeBy.title")}
          </ExternalLink>
        </p>
      </footer>

      {/* Cloudflare Web Analytics (manual injection) */}
      {env.NODE_ENV === "production" && (
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "2670b414c17d439c81ec294732f48bf8"}'
        ></script>
      )}
    </>
  );
}
