import { createSearchPage } from "../create-search-page";

const { generateStaticParams, generateMetadata, SearchPage } = createSearchPage(
  {
    type: "vfr",
    namespace: "VfrPage",
    href: "/vfr",
    schemaPrefix: "AIP VFR",
  },
);

// Every valid locale is prerendered by generateStaticParams() below.
// dynamicParams = true lets a KNOWN locale self-heal via on-demand SSR when its
// OpenNext R2 incremental-cache entry is missing (post-deploy empty-cache
// window / eviction) instead of returning a hard NoFallbackError 404. Unknown
// locales are still rejected: the [locale] layout calls notFound() for any slug
// not in routing.locales, and unknown sub-paths 404 at the router.
export const dynamicParams = true;
export { generateStaticParams, generateMetadata };
export default SearchPage;
