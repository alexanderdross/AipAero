import type { PageTranslation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";
import { generateProductSchema } from "~/lib/generate-schema";

export function ContentAirportsPage({translation}: { translation: PageTranslation; }) {
  return (
    <>
      {generateProductSchema(
        translation.title, // name
        `${translation.menuTitle} ${translation.Country}`, // alternateName`${translation.menuTitle} ${translation.Country}`, // alternateName
        translation.description, // description
        translation.href // href
      )}
      <Header
        title={translation.title}
        description={translation.description}
      />
    </>
  );
}