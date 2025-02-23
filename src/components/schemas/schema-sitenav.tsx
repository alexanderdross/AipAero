import { getTranslations } from "next-intl/server";
import { getPathname, Pathnames } from "~/i18n/routing";
import { orgUrl, rootSiteNav } from "~/lib/utils";

export async function SchemaSitenav({ locale }: { locale: string }) {
  const siteKeys = locale.startsWith('de') ?
    ['VfrPage', 'IfrPage', 'HeliportPage', 'AirportsPage'] as const
    : ['VfrPage', 'HeliportPage', 'AirportsPage'] as const;
  const siteTranslations = await Promise.all(
    siteKeys.map(x => getTranslations(x))
  );
  const slugs = locale.startsWith('de') ?
    ['/vfr', '/ifr', '/heliports', '/airport-list'] as Pathnames[]
    : ['/vfr', '/heliports', '/airport-list'] as Pathnames[]
  const siteNavSchema = {
    "@context": "https://schema.org",
    "@graph": [
      ...rootSiteNav,
      ...siteTranslations.map((p, i) => ({
        "@context": "https://schema.org",
        "@type": "SiteNavigationElement",
        "name": p('breadcrumb.alternateName'),
        "alternateName": p('breadcrumb.name'),
        "description": p('breadcrumb.description'),
        "url": new URL(getPathname({ href: slugs[i] as Pathnames, locale }), orgUrl).toString(),
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