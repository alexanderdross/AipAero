import { createSearchPage } from "../create-search-page";

// Only available for France (see countryTypeAvailability)
const { generateStaticParams, generateMetadata, SearchPage } = createSearchPage(
  {
    type: "aeroport",
    namespace: "AeroportPage",
    href: "/aeroports",
    schemaPrefix: "AIP",
  },
);

// All slugs besides the static ones will be 404
export const dynamicParams = false;
export { generateStaticParams, generateMetadata };
export default SearchPage;
