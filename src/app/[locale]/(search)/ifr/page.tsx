import { createSearchPage } from "../create-search-page";

// Only available for Germany (see countryTypeAvailability)
const { generateStaticParams, generateMetadata, SearchPage } = createSearchPage(
  {
    type: "ifr",
    namespace: "IfrPage",
    href: "/ifr",
    schemaPrefix: "AIP IFR",
  },
);

// All slugs besides the static ones will be 404
export const dynamicParams = false;
export { generateStaticParams, generateMetadata };
export default SearchPage;
