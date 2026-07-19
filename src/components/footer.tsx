import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "~/components/external-link";
import { env } from "~/env";
import { getPathname, type Locale } from "~/i18n/routing";
import { navItems } from "~/lib/nav-items";
import { tradeAeroUrl } from "~/lib/trade-aero";
import { countryMeta, liveCountries } from "~/lib/utils";

/**
 * Site footer: three named groups (navigation / legal / partners) instead of
 * the former pipe-separated text rows (the "|" strings were announced by
 * screen readers; lists + CSS gaps are not).
 *
 * - Navigation: the country's main pages from the shared nav-items (localized
 *   SEO titles from the Menu namespace) - site-wide internal links on every
 *   page, plain followed same-tab <a>. On the GLOBAL homepage (no locale
 *   context) the group lists the live countries instead (`global` prop).
 * - Legal/network: our own root-level pages (terms/imprint/privacy/contact,
 *   language-correct slug) as plain internal <a>, plus the genuinely external
 *   owner-site home (dross.net).
 * - Partners: Trade:Aero (locale + country aware deep link, followed) and
 *   Stratux.
 *
 * All SSR, zero client JS; the footer starts below the fold on every page
 * (main min-h-screen), so the added height is Web-Vitals-free. Group labels
 * are <p>, not headings - heading levels vary per page and a footer <h2>/<h3>
 * could break axe's heading-order rule depending on the page outline.
 */
export default async function Footer({ global = false }: { global?: boolean }) {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const tMenu = await getTranslations("Menu");

  // getPathname emits the trailing slash for sub-paths but not for a locale
  // root - normalize instead of blindly appending (a "//" link costs every
  // internal footer click a 308 redirect hop).
  const withSlash = (p: string) => (p.endsWith("/") ? p : p + "/");

  const navLinks = global
    ? liveCountries.map((cc) => {
        const meta = countryMeta[cc];
        return {
          key: cc,
          href: withSlash(getPathname({ href: "/", locale: cc as Locale })),
          title: `${meta?.flag ?? ""} ${meta?.name ?? cc.toUpperCase()}`.trim(),
          // Same keyword-rich pattern as the homepage about-box links.
          titleAttr: `Aeronautical Information Publication (AIP) of ${meta?.name ?? cc.toUpperCase()}`,
        };
      })
    : [
        // Root entry: back to the global country index.
        {
          key: "aipHome",
          href: "/",
          title: t("aipHome.title"),
          titleAttr: t("aipHome.hrefTitle"),
        },
        ...navItems
          .filter((item) => tMenu.has(`${item.key}.title`))
          .map((item) => ({
            key: item.key,
            href: withSlash(
              getPathname({ href: item.href, locale: locale as Locale }),
            ),
            title: tMenu(`${item.key}.title`),
            titleAttr: tMenu(`${item.key}.hrefTitle`),
          })),
        // The EFB usage guide (install, offline charts, PDF import).
        {
          key: "efb",
          href: withSlash(getPathname({ href: "/efb", locale })),
          title: t("efb.title"),
          titleAttr: t("efb.hrefTitle"),
        },
        // The aviation glossary (AIP, AIRAC, VFR/IFR, METAR/TAF, charts).
        {
          key: "glossary",
          href: withSlash(getPathname({ href: "/glossary", locale })),
          title: t("glossary.title"),
          titleAttr: t("glossary.hrefTitle"),
        },
        // Pilot guides (reading charts, AIRAC cycle, decoding METAR/TAF).
        {
          key: "guides",
          href: withSlash(getPathname({ href: "/guides", locale })),
          title: t("guides.title"),
          titleAttr: t("guides.hrefTitle"),
        },
      ];

  // Our own legal + contact pages are ROOT-level, single-language pages paired
  // by topic (/terms + /agb, /imprint + /impressum, /privacy + /datenschutz,
  // /contact + /de/kontakt), NOT locale-prefixed. German-native locales
  // (de/at/ch) link to the German page; every other locale links to the English
  // one. The link LABELS are already localized (the keys exist in every Footer
  // namespace), so they match the target language. Only the owner-site home
  // (dross.net) stays external.
  const germanLegal = ["de", "at", "ch"].includes(locale);
  const legalSlug: Record<"terms" | "imprint" | "privacy" | "contact", string> =
    germanLegal
      ? {
          terms: "de/agb",
          imprint: "de/impressum",
          privacy: "de/datenschutz",
          contact: "de/kontakt",
        }
      : {
          terms: "terms",
          imprint: "imprint",
          privacy: "privacy",
          contact: "contact",
        };
  const legalInternal = ["terms", "imprint", "privacy", "contact"] as const;
  const legalExternal = ["home"] as const;

  const groupLabel =
    "text-drossgray-dark text-xs font-semibold tracking-wider uppercase";
  const linkRow =
    "text-drossblue inline-flex min-h-10 items-center hover:underline";

  return (
    <>
      <footer className="border-drossgray-dark/10 border-t">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-3">
            {/* Site navigation: internal, followed, same tab. The global
                variant lists every live country - two columns keep the
                group from growing a full row per launched country. */}
            <nav aria-label={t("navTitle")}>
              <p className={groupLabel}>{t("navTitle")}</p>
              <ul
                className={
                  global
                    ? "mt-2 grid grid-cols-2 gap-x-4"
                    : "mt-2 flex flex-col"
                }
              >
                {navLinks.map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.href}
                      title={link.titleAttr}
                      className={linkRow}
                    >
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Legal / owner network. */}
            <div>
              <p className={groupLabel}>{t("legalTitle")}</p>
              <ul className="mt-2 flex flex-col">
                {legalInternal.map((key) => (
                  <li key={key}>
                    {/* Root-level single-language page: plain followed same-tab
                        link at a fixed, non-locale-prefixed path. */}
                    <a
                      href={`/${legalSlug[key]}/`}
                      title={t(`${key}.hrefTitle`)}
                      className={linkRow}
                    >
                      {t(`${key}.title`)}
                    </a>
                  </li>
                ))}
                {legalExternal.map((key) => (
                  <li key={key}>
                    <ExternalLink
                      href={t(`${key}.href`)}
                      hrefTitle={t(`${key}.hrefTitle`)}
                      className={linkRow}
                    >
                      {t(`${key}.title`)}
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Partner properties. */}
            <div>
              <p className={groupLabel}>{t("partnersTitle")}</p>
              <ul className="mt-2 flex flex-col">
                <li>
                  <ExternalLink
                    href={tradeAeroUrl(locale)}
                    hrefTitle={t("tradeaero.hrefTitle")}
                    rel="noopener"
                    className={linkRow}
                  >
                    {t("tradeaero.title")}
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink
                    href={t("stratux.href")}
                    hrefTitle={t("stratux.hrefTitle")}
                    className={linkRow}
                  >
                    {t("stratux.title")}
                  </ExternalLink>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-drossgray-dark mt-8 text-center text-base">
            &copy; {new Date().getFullYear()} made with ♥ by
            <ExternalLink
              href={t("madeBy.href")}
              hrefTitle={t("madeBy.hrefTitle")}
              rel="author noopener noreferrer nofollow"
              className="text-drossblue mx-2 text-base italic hover:underline"
            >
              {t("madeBy.title")}
            </ExternalLink>
          </p>
        </div>
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
