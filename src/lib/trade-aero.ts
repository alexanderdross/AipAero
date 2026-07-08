import { localeCountryMapping, localeLangMapping } from "~/i18n/routing";

/**
 * Deep-link builder for the sister marketplace Trade:Aero (https://trade.aero).
 *
 * Trade:Aero addresses a listing page as: a **language subdirectory** (English at
 * the root, otherwise `/de`, `/fr`, `/nl`, …) + a **localized "aircraft" slug**,
 * and narrows the results with a **`?country=<ISO-3166 alpha-2>`** query param.
 *
 * The URL is derived entirely from AIP:Aero's own locale config
 * (`localeLangMapping` / `localeCountryMapping` in `src/i18n/routing.ts`), so
 * **adding a country/locale to AIP:Aero automatically produces its Trade:Aero
 * cross-link — no per-country wiring here.** Two graceful fallbacks keep a new
 * locale working out of the box:
 *   1. Unknown language → the English listing (`/aircraft/`), still correctly
 *      country-filtered. Add the language below once its localized slug is known.
 *   2. Country code defaults to the uppercased AIP code (which equals the ISO
 *      alpha-2 for every current + planned country); only genuine mismatches need
 *      an entry in `TRADE_COUNTRY_OVERRIDES`.
 */

// Trade:Aero language code → path prefix + localized listing slug. English lives
// at the root (empty prefix). Trade:Aero supports 14 languages; extend this map
// as the localized slugs for further languages (it/es/pl/cs/sv/pt/ru/tr/el/no)
// are confirmed.
const TRADE_LANG: Record<string, { prefix: string; slug: string }> = {
  en: { prefix: "", slug: "aircraft" },
  de: { prefix: "/de", slug: "flugzeuge" },
  fr: { prefix: "/fr", slug: "aeronefs" },
  nl: { prefix: "/nl", slug: "vliegtuigen" },
};

// AIP country code → Trade:Aero `?country=` value. Defaults to the uppercased AIP
// code; list only the codes where AIP differs from ISO-3166 alpha-2.
const TRADE_COUNTRY_OVERRIDES: Record<string, string> = {
  uk: "GB", // AIP uses "uk"; ISO-3166 / Trade:Aero use "GB" for the United Kingdom.
};

const TRADE_BASE = "https://trade.aero";

// Referral attribution so Trade:Aero can see AIP:Aero as the traffic source.
const UTM = "utm_source=aip.aero&utm_medium=referral&utm_campaign=cross-link";

/** Build the locale + country aware Trade:Aero listing URL for an AIP:Aero locale. */
export function tradeAeroUrl(locale: string): string {
  const lang = localeLangMapping[locale] ?? "en";
  const { prefix, slug } = TRADE_LANG[lang] ?? TRADE_LANG.en!;
  const aipCountry = localeCountryMapping[locale] ?? "";
  const country =
    TRADE_COUNTRY_OVERRIDES[aipCountry] ?? aipCountry.toUpperCase();
  return `${TRADE_BASE}${prefix}/${slug}/?country=${country}&${UTM}`;
}
