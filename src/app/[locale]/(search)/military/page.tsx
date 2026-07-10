import { createSearchPage } from "../create-search-page";

// Only available for France (see countryTypeAvailability)
const { generateStaticParams, generateMetadata, SearchPage } = createSearchPage(
  {
    type: "mil",
    namespace: "MilitaryPage",
    href: "/military",
    schemaPrefix: "AIP MIL",
  },
);

// All slugs besides the static ones will be 404
export const dynamicParams = false;
export { generateStaticParams, generateMetadata };
export default SearchPage;
