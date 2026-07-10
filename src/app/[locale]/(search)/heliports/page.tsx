import { createSearchPage } from "../create-search-page";

const { generateStaticParams, generateMetadata, SearchPage } = createSearchPage(
  {
    type: "heliport",
    namespace: "HeliportPage",
    href: "/heliports",
    schemaPrefix: "Heliports",
  },
);

// All slugs besides the static ones will be 404
export const dynamicParams = false;
export { generateStaticParams, generateMetadata };
export default SearchPage;
