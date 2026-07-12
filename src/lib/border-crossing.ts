/**
 * National border-crossing / customs notification forms for general aviation
 * (pilot-wishlist item "Customs / Airport-of-Entry flag + national
 * border-crossing form links"). Rendered as an outbound link in the
 * contact/location box on airport detail pages.
 *
 * Only VERIFIED official links belong here (each checked against the
 * authority's own site before adding) - a wrong border-crossing link is a
 * compliance hazard for the pilot, so no best-effort entries. Countries
 * without a national online form (most Schengen states have none for
 * intra-Schengen GA flights) simply have no entry.
 */
export interface BorderCrossingForm {
  /** Official short name of the form/procedure - a proper noun, not translated. */
  name: string;
  /** Verified official URL (guidance page, which links the submission portal). */
  href: string;
}

const FORMS: Record<string, BorderCrossingForm> = {
  // UK: a General Aviation Report (GAR) must be submitted for EVERY
  // international GA flight to or from the UK (48h-12h before departure),
  // regardless of the individual field's customs status - so the link renders
  // on all UK detail pages. Verified 2026-07: the GOV.UK guidance publication,
  // which links the sGAR submission portal
  // (submit-general-aviation-report.service.gov.uk).
  UK: {
    name: "GAR",
    href: "https://www.gov.uk/government/publications/general-aviation-operators-and-pilots-notification-of-flights",
  },
};

export function borderCrossingForm(country: string): BorderCrossingForm | null {
  return FORMS[country.toUpperCase()] ?? null;
}
