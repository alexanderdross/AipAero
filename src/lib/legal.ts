/**
 * Language-independent legal data for the /imprint and /privacy pages.
 *
 * The provider details (name, VAT, tax number, contact) and the third-party
 * service links are the same in every language, so - like the Terms page's
 * AIP_SOURCES - they live in code. The /imprint and /privacy pages themselves
 * are root-level bilingual (DE+EN) pages that render this data directly.
 */

/** Provider / responsible person (§ 5 DDG / § 18 MStV). */
export const IMPRINT = {
  /** Responsible person. */
  name: "Alexander Dross",
  /** The brand AIP:Aero is a project of. */
  brand: "Dross:Media",
  /** Owner network home (the brand link target). */
  brandUrl: "https://dross.net",
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
