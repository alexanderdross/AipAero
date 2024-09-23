import type { PageTranslation } from "~/lib/i18n";
import { Header } from "~/app/_components/header";

export function ContentAirportsPage({locale, translation}: { locale: string; translation: PageTranslation; }) {
  return (
    <>
      <Header
        title={translation.title}
        description={translation.description}
      />
    </>
  );
}