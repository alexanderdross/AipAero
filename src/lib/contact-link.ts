/**
 * German-native site locales. They link to the German contact page (and legal
 * pages); every other locale links to the English one. Kept in sync with the
 * same set in `src/components/footer.tsx` (the legal-link language routing).
 */
const GERMAN_LOCALES = ["de", "at", "ch"];

/**
 * Build the contact-form URL for a "report a problem" link on an airport detail
 * page, pre-filling the aerodrome reference.
 *
 * The contact form is TWO root-level single-language pages (like the legal
 * pages): English at `/contact/`, German at `/de/kontakt/`. German-native
 * locales (de, at, ch) get the German page; every other locale gets the English
 * one. This mirrors the footer's legal-link language routing.
 *
 * The reference is passed as a query param the contact page reads and sanitizes:
 * an ICAO-bearing field forwards `?icao=<ICAO>`; an ICAO-less field (helipad /
 * ULM strip) forwards `?ref=<slug>` so the page can still seed the subject from
 * the field, leaving the ICAO input empty.
 *
 * Pure (no env / routing / request access) so it is unit-testable and safe to
 * call in the server render of the gadgets.
 */
export function contactUrlFor(
  locale: string,
  ref: { icao?: string | null; slug?: string | null },
): string {
  const base = GERMAN_LOCALES.includes(locale) ? "/de/kontakt/" : "/contact/";
  const params = new URLSearchParams();
  if (ref.icao) {
    params.set("icao", ref.icao);
  } else if (ref.slug) {
    params.set("ref", ref.slug);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Sanitize a raw `?icao=` query value before it is echoed into the contact
 * form / e-mail subject. Returns the upper-cased ICAO when it is a plausible
 * code (2-4 alphanumerics, e.g. EDNY, LFPG, plain letters for a name-only
 * strip), else null. Fails closed - never trust the raw query string.
 */
export function sanitizeIcao(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  return /^[A-Z0-9]{2,4}$/.test(v) ? v : null;
}

/**
 * Sanitize a raw `?ref=` query value (an aerodrome slug for ICAO-less fields).
 * Slugs are lower-case alphanumerics + hyphens; cap the length and reject
 * anything else so it is safe to place in the subject line.
 */
export function sanitizeRef(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return /^[a-z0-9-]{1,64}$/.test(v) ? v : null;
}
