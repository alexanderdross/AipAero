import { IMPRINT } from "~/lib/legal";
import { orgUrl } from "~/lib/utils";

/**
 * Site-level Organization node (the publishing entity behind AIP:Aero) with its
 * logo, brand `sameAs` links and its `founder` Person. Gives search/LLM engines
 * a stable entity to attach the site to (knowledge graph, E-E-A-T) - there was
 * no Organization/Person node before. `@id` is stable so the `WebSite.publisher`
 * reference resolves to it and crawlers dedupe it into one entity. Rendered once
 * per document (layout for [locale] pages, inline on the root homepage) and,
 * being byte-identical, also swept by `SchemaDedupe`. Server component, no JS.
 */
export function SchemaOrganization() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${orgUrl.toString()}#organization`,
    name: "AIP:Aero",
    url: orgUrl.toString(),
    logo: {
      "@type": "ImageObject",
      url: new URL("/aip-logo-450x450.jpg", orgUrl).toString(),
      width: 450,
      height: 450,
    },
    // Authoritative brand/network profiles (not social vanity links).
    sameAs: [IMPRINT.mediaUrl, "https://trade.aero/"],
    founder: {
      "@type": "Person",
      name: IMPRINT.name,
      url: IMPRINT.personUrl,
      sameAs: ["https://x.com/alexanderdross"],
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
