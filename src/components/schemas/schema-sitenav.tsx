import { getTranslations } from "next-intl/server";
import {
  getPathname,
  localeCountryMapping,
  type Pathnames,
} from "~/i18n/routing";
import { countryTypeAvailability, orgUrl } from "~/lib/utils";
import type { Airport } from "~/server/db/schema";

// Per available type: the message namespace holding its breadcrumb copy and
// the localized route it links to.
const TYPE_META: Record<Airport["type"], { ns: string; slug: Pathnames }> = {
  vfr: { ns: "VfrPage", slug: "/vfr" },
  ifr: { ns: "IfrPage", slug: "/ifr" },
  heliport: { ns: "HeliportPage", slug: "/heliports" },
  aeroport: { ns: "AeroportPage", slug: "/aeroports" },
  mil: { ns: "MilitaryPage", slug: "/military" },
};

export async function SchemaSitenav({ locale }: { locale: string }) {
  function trailingSlash(url: string) {
    return url.endsWith("/") ? url : url + "/";
  }

  // Data-driven from the country's available types, so every country (and any
  // future one) contributes the right SiteNavigation nodes automatically.
  const country = localeCountryMapping[locale]!;
  const types = countryTypeAvailability[country] ?? [];
  const siteKeys = [
    "CountryPage",
    ...types.map((t) => TYPE_META[t].ns),
    "AirportsPage",
  ];
  const slugs = [
    "/",
    ...types.map((t) => TYPE_META[t].slug),
    "/airport-list",
  ] as Pathnames[];

  const siteTranslations = await Promise.all(
    siteKeys.map((x) => getTranslations(x)),
  );

  // The navigation entries (site self-link, sister project, then one per
  // available page for this country).
  const navItems = [
    {
      name: "AIP approach charts for VFR, IFR & Heliports across Europe",
      alternateName: "AIP:Aero",
      description:
        "AIP approach charts VFR, IFR & Heliports for European countries",
      url: orgUrl.toString(),
    },
    {
      name: "Stratux - Anti-Collision System",
      alternateName: "Dross:Aviation",
      description:
        "Stratux, Anti-Collision System for private aviation and gliders",
      url: "https://dross.net/aviation/?aip",
    },
    ...siteTranslations.map((p, i) => ({
      name: p("breadcrumb.alternateName"),
      alternateName: p("breadcrumb.name"),
      description: p("breadcrumb.description"),
      url: trailingSlash(
        new URL(getPathname({ href: slugs[i]!, locale }), orgUrl).toString(),
      ),
    })),
  ];

  // Wrap the SiteNavigationElement nodes as an ordered ItemList that is the
  // main entity of the country's CollectionPage (its entry page), so the
  // navigation is one structured collection rather than a flat list of nodes.
  // `position` is valid on SiteNavigationElement (a CreativeWork subtype).
  const siteNavSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: siteTranslations[0]!("breadcrumb.alternateName"),
    url: trailingSlash(
      new URL(getPathname({ href: "/", locale }), orgUrl).toString(),
    ),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: navItems.map((item, i) => ({
        "@type": "SiteNavigationElement",
        position: i + 1,
        name: item.name,
        alternateName: item.alternateName,
        description: item.description,
        url: item.url,
      })),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(siteNavSchema),
      }}
    />
  );
}
