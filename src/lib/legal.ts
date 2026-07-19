/**
 * Language-independent legal data for the legal pages.
 *
 * The provider details (name, VAT, tax number, contact), the third-party
 * service links and the AIP-source attribution are the same in every language,
 * so they live in code. The legal pages are root-level single-language pages
 * paired by topic (/imprint + /impressum, /privacy + /datenschutz, /terms +
 * /agb), cross-linked with hreflang, that render this data directly.
 */

/** Provider / responsible person (§ 5 DDG / § 18 MStV). */
export const IMPRINT = {
  /** Responsible person. */
  name: "Alexander Dross",
  /** The brand AIP:Aero is a project of. */
  brand: "Dross:Media",
  /** Owner network home. */
  brandUrl: "https://dross.net",
  /** The Dross:Media brand page (the "Dross:Media" link target). */
  mediaUrl: "https://dross.net/media/",
  /** Personal page of the responsible person (the name link target). */
  personUrl: "https://dross.net/alexander/",
  /** Contact e-mail shown to the user... */
  email: "mail@dross.net",
  /** ...but the link points at the contact form (owner request). */
  contactUrl: "https://dross.net/contact",
  /** VAT identification number (USt-IdNr, § 27a UStG). */
  vatId: "DE311210968",
  /** Tax number (Steuernummer). */
  taxNumber: "61123/34525",
} as const;

/** External services referenced on the privacy page (for the "learn more"
 * links). Kept in code so the descriptions can be translated without the URLs
 * drifting per locale. */
export const PRIVACY_LINKS = {
  cloudflare: "https://www.cloudflare.com/privacypolicy/",
  google: "https://policies.google.com/privacy",
  googleAdsSettings: "https://adssettings.google.com",
  osm: "https://osmfoundation.org/wiki/Privacy_Policy",
  /** The full network-wide privacy policy for details beyond this site. */
  fullPolicy: "https://dross.net/privacy-policy",
} as const;

// Official AIP providers we link to, rendered (as plain non-clickable text) on
// both terms pages (/terms + /agb). Language-independent, so it lives here.
// KEEP THIS IN SYNC WITH `liveCountries` (src/lib/utils.ts): every launched
// country's official AIP provider must be listed here (attribution). `cc` = the
// liveCountries code; scripts/check-live-countries-coverage.mjs asserts every
// live country is attributed here (BE covers BE+LU, one row). Order follows
// onboarding order.
export const AIP_SOURCES: { cc: string; name: string; url: string }[] = [
  {
    cc: "at",
    name: "Austro Control (Österreich)",
    url: "https://eaip.austrocontrol.at",
  },
  {
    cc: "be",
    name: "skeyes (Belgium & Luxembourg)",
    url: "https://ops.skeyes.be",
  },
  { cc: "cz", name: "ANS CR (Česko)", url: "https://aim.rlp.cz" },
  { cc: "dk", name: "Naviair (Danmark)", url: "https://aim.naviair.dk" },
  {
    cc: "de",
    name: "DFS Deutsche Flugsicherung (Deutschland)",
    url: "https://aip.dfs.de",
  },
  {
    cc: "fr",
    name: "SIA - Service de l'Information Aéronautique (France)",
    url: "https://www.sia.aviation-civile.gouv.fr",
  },
  { cc: "gr", name: "HASP (Ελλάδα)", url: "https://aisgr.hasp.gov.gr" },
  { cc: "nl", name: "LVNL (Nederland)", url: "https://eaip.lvnl.nl" },
  { cc: "no", name: "Avinor (Norge)", url: "https://aim-prod.avinor.no" },
  { cc: "pl", name: "PANSA (Polska)", url: "https://www.ais.pansa.pl" },
  { cc: "se", name: "LFV (Sverige)", url: "https://aro.lfv.se" },
  {
    cc: "uk",
    name: "NATS (United Kingdom)",
    url: "https://nats-uk.ead-it.com",
  },
  { cc: "ee", name: "EANS (Eesti)", url: "https://eaip.eans.ee" },
  { cc: "fi", name: "Fintraffic ANS (Suomi)", url: "https://www.ais.fi" },
  { cc: "es", name: "ENAIRE (España)", url: "https://aip.enaire.es" },
  { cc: "lv", name: "LGS (Latvija)", url: "https://ais.lgs.lv" },
  { cc: "is", name: "Isavia (Ísland)", url: "https://eaip.isavia.is" },
  { cc: "pt", name: "NAV Portugal (Portugal)", url: "https://ais.nav.pt" },
  {
    cc: "hu",
    name: "HungaroControl (Magyarország)",
    url: "https://ais.hungarocontrol.hu",
  },
  {
    cc: "si",
    name: "Slovenia Control (Slovenija)",
    url: "https://aim.sloveniacontrol.si",
  },
  { cc: "lt", name: "Oro navigacija (Lietuva)", url: "https://www.ans.lt" },
  { cc: "rs", name: "SMATSA (Srbija)", url: "https://smatsa.rs" },
  { cc: "ie", name: "AirNav Ireland (Ireland)", url: "https://www.airnav.ie" },
  { cc: "sk", name: "LPS SR (Slovensko)", url: "https://aim.lps.sk" },
  {
    cc: "ba",
    name: "BHANSA (Bosna i Hercegovina)",
    url: "https://eaip.bhansa.gov.ba",
  },
  {
    cc: "ch",
    name: "skybriefing / skyguide (Schweiz)",
    url: "https://www.skybriefing.com",
  },
  { cc: "al", name: "Albcontrol (Shqipëri)", url: "https://www.albcontrol.al" },
  {
    cc: "mk",
    name: "M-NAV (Severna Makedonija)",
    url: "https://ais.m-nav.info",
  },
  { cc: "ro", name: "AISRO / ROMATSA (România)", url: "https://www.aisro.ro" },
  {
    cc: "cy",
    name: "DCA Cyprus (Κύπρος)",
    url: "http://vfrmanual.dca.mcw.gov.cy",
  },
  {
    cc: "mt",
    name: "MATS / Transport Malta (Malta)",
    url: "https://www.transport.gov.mt",
  },
  { cc: "md", name: "MOLDATSA (Moldova)", url: "https://aim.moldatsa.md" },
  { cc: "it", name: "ENAV (Italia)", url: "https://www.enav.it" },
  {
    cc: "hr",
    name: "Croatia Control (Hrvatska)",
    url: "https://www.crocontrol.hr",
  },
  { cc: "bg", name: "BULATSA (България)", url: "https://www.bulatsa.com" },
  { cc: "tr", name: "DHMI (Türkiye)", url: "https://dhmi.gov.tr" },
  {
    cc: "ge",
    name: "Sakaeronavigatsia (საქართველო)",
    url: "https://airnav.ge",
  },
  { cc: "am", name: "ARMATS (Հայաստան)", url: "https://armats.am" },
  {
    cc: "az",
    name: "AZANS / State Civil Aviation Agency (Azərbaycan)",
    url: "https://www.caa.gov.az",
  },
  { cc: "ua", name: "UkSATSE (Україна)", url: "https://www.aisukraine.net" },
  {
    cc: "uz",
    name: "Uzaeronavigation (Oʻzbekiston)",
    url: "https://uzaeronavigation.com",
  },
  {
    cc: "by",
    name: "Belaeronavigatsia (Беларусь)",
    url: "https://www.ban.by",
  },
  {
    cc: "kz",
    name: "Kazaeronavigatsia (Қазақстан)",
    url: "https://www.ans.kz",
  },
  { cc: "xk", name: "ASHNA / CAA Kosovo (Kosova)", url: "https://kans-ks.org" },
  { cc: "ru", name: "CAICA (Россия)", url: "https://www.caica.ru" },
  {
    cc: "tj",
    name: "Tajikairnavigation (Тоҷикистон)",
    url: "https://www.caica.ru/aiptjk",
  },
  {
    cc: "tm",
    name: "Turkmenhowayollary (Türkmenistan)",
    url: "https://www.caica.ru/aiptkm",
  },
  {
    cc: "kg",
    name: "Kyrgyzaeronavigatsia (Кыргызстан)",
    url: "https://ansp.kg",
  },
  {
    cc: "au",
    name: "Airservices Australia",
    url: "https://www.airservicesaustralia.com/aip/aip.asp",
  },
  {
    cc: "nz",
    name: "Aeropath / Airways New Zealand",
    url: "https://www.aip.net.nz",
  },
];

/** Embedded external data sources - descriptors translated inline (en / de). */
export const DATA_SOURCES: {
  name: string;
  url: string;
  en: string;
  de: string;
}[] = [
  {
    name: "NOAA / Aviation Weather Center",
    url: "https://aviationweather.gov",
    en: "weather METAR/TAF and airport data",
    de: "Wetter METAR/TAF und Flugplatzdaten",
  },
  {
    name: "OurAirports",
    url: "https://ourairports.com",
    en: "airport base data",
    de: "Flugplatz-Basisdaten",
  },
  {
    name: "OpenAIP",
    url: "https://www.openaip.net",
    en: "extended aerodrome data: runways, frequencies, fuel",
    de: "erweiterte Flugplatzdaten: Pisten, Frequenzen, Kraftstoff",
  },
  {
    name: "OpenStreetMap / Nominatim",
    url: "https://www.openstreetmap.org",
    en: "maps and addresses",
    de: "Karten und Adressen",
  },
];
