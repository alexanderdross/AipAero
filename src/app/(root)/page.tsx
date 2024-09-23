import { getTranslations } from "~/lib/i18n";
import { ContentRootPage } from "~/app/_components/content-root-page";

export default async function Home() {
  const countries = getTranslations({});
  return <ContentRootPage translations={countries} />;
}
