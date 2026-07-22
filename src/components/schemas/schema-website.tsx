import { orgUrl, rootTitle } from "~/lib/utils";

/**
 * Site-level WebSite node with the Sitelinks-SearchBox action. IDENTICAL on
 * every page (same @id as the global homepage's inline copy, so crawlers
 * dedupe it into one entity): WebSite.url is the SITE root, and the
 * SearchAction target is the ONE URL that actually executes a search - the
 * global homepage, whose AirportSearchBox picks up the valueless query
 * key (https://aip.aero/?EDNY) and searches across all countries. It must
 * NEVER be built from the current pathname: /de/efb/?{term} executes nothing,
 * and /de/vfr/?{term} is the ?ICAO DETAIL scheme, not a search (owner-found
 * markup bug, 14.07.2026). Server component - no client JS.
 */
export function SchemaWebsite() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${orgUrl.toString()}#website`,
    url: orgUrl.toString(),
    name: "AIP:Aero",
    alternateName: rootTitle,
    // Resolves to the Organization node (schema-organization.tsx) rendered on
    // the same document, giving the site a stable publishing entity.
    publisher: { "@id": `${orgUrl.toString()}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        // orgUrl carries the trailing slash: https://aip.aero/?...
        urlTemplate: `${orgUrl.toString()}?{search_term_string}`,
      },
      // maxlength mirrors the server action's search validation.
      "query-input": "required maxlength=50 name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  );
}
