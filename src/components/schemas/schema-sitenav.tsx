import { getTranslations } from "next-intl/server";
import { getPathname, Pathnames } from "~/i18n/routing";
import { orgUrl } from "~/lib/utils";

export async function SchemaSitenav({ locale }: { locale: string }) {
  function trailingSlash(url: string) {
    return url.endsWith('/') ? url : url + '/';
  }

  const siteKeys = locale.startsWith('de') ?
    ['CountryPage', 'VfrPage', 'IfrPage', 'HeliportPage', 'AirportsPage'] as const
    : locale.startsWith('fr') ? ['CountryPage', 'AeroportPage', 'MilitaryPage', 'AirportsPage'] as const
      : ['CountryPage', 'VfrPage', 'HeliportPage', 'AirportsPage'] as const;
  const siteTranslations = await Promise.all(
    siteKeys.map(x => getTranslations(x))
  );
  const slugs = locale.startsWith('de') ?
    ['/', '/vfr', '/ifr', '/heliports', '/airport-list'] as Pathnames[]
    : locale.startsWith('fr') ? ['/', '/aeroports', '/military', '/airport-list'] as Pathnames[]
      : ['/', '/vfr', '/heliports', '/airport-list'] as Pathnames[]
  const siteNavSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": "AIP approach charts of Austria, Germany, Netherlands and United Kingdom",
        "alternateName": "AIP:Aero",
        "description": "AIP approach charts VFR, IFR & Heliports of Austria, Germany, Netherlands and United Kingdom",
        "url": orgUrl.toString()
      },
      {
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": "Stratux - Anti-Collision System",
        "alternateName": "Dross:Aviation",
        "description": "Stratux, Anti-Collision System for private aviation and gliders",
        "url": "https://dross.net/aviation/?aip"
      },
      ...siteTranslations.map((p, i) => ({
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": p('breadcrumb.alternateName'),
        "alternateName": p('breadcrumb.name'),
        "description": p('breadcrumb.description'),
        "url": trailingSlash(new URL(getPathname({ href: slugs[i] as Pathnames, locale }), orgUrl).toString()),
      }))
    ]
  }
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(siteNavSchema)
    }}
  />;
}