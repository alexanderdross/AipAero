import { createSearchPage } from "../create-search-page";

const { generateStaticParams, generateMetadata, SearchPage } = createSearchPage(
  {
    type: "vfr",
    namespace: "VfrPage",
    href: "/vfr",
    schemaPrefix: "AIP VFR",
  },
);

// All slugs besides the static ones will be 404
export const dynamicParams = false;
export { generateStaticParams, generateMetadata };
export default SearchPage;
