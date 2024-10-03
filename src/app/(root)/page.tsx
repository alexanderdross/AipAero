import { getTranslations } from "~/lib/i18n";
import { ContentRootPage } from "~/app/_components/pages/content-root-page";

export default async function Home() {
  const countries = await getTranslations({});
  return <ContentRootPage translations={countries} />;
}
