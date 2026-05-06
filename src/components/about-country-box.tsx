import { getTranslations } from "next-intl/server";
import { AboutBox } from "~/components/about-box";
import { ExternalLink } from "~/components/external-link";

export async function AboutCountryBox({ isH3 = false }) {
  const t = await getTranslations("About");

  return (
    <AboutBox title={t("title")} isH3={isH3}>
      {t.rich("description", {
        aip: (chunks) => (
          <ExternalLink
            className="text-drossblue hover:underline"
            href={t("aipUrl")}
            hrefTitle={t("aipTitle")}
          >
            {chunks}
          </ExternalLink>
        ),
      })}
    </AboutBox>
  );
}
