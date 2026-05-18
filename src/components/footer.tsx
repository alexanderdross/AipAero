import { Fragment } from "react";
import { ExternalLink } from "~/components/external-link";
import { getTranslations } from "next-intl/server";

export default async function Footer() {
  const t = await getTranslations("Footer");
  const keysTop = ["stratux", "tradeaero"] as const;
  const keysMiddle = ["home", "imprint", "contact", "privacy"] as const;

  return (
    <>
      <footer className="mx-auto max-w-7xl overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        {/* Top links */}
        <div className="flex flex-wrap justify-center gap-x-2 px-5 py-2">
          {keysTop.map((key, idx) => (
            <Fragment key={idx}>
              <ExternalLink
                href={t(`${key}.href`)}
                hrefTitle={t(`${key}.hrefTitle`)}
                className="text-drossblue mx-2 text-base hover:underline"
              >
                {t(`${key}.title`)}
              </ExternalLink>
              {idx < keysTop.length - 1 && "|"}
            </Fragment>
          ))}
        </div>

        {/* Middle links */}
        <div className="flex flex-wrap justify-center">
          {keysMiddle.map((key, idx) => (
            <Fragment key={idx}>
              <ExternalLink
                href={t(`${key}.href`)}
                hrefTitle={t(`${key}.hrefTitle`)}
                className="text-drossblue mx-2 text-base hover:underline"
              >
                {t(`${key}.title`)}
              </ExternalLink>
              {idx < keysMiddle.length - 1 && "|"}
            </Fragment>
          ))}
        </div>

        {/* Bottom */}
        <p className="text-drossgray-dark mt-2 text-center text-base">
          &copy; {new Date().getFullYear()} made with ♥ by
          <ExternalLink
            href={t("madeBy.href")}
            hrefTitle={t("madeBy.hrefTitle")}
            className="text-drossblue mx-2 text-base italic hover:underline"
          >
            {t("madeBy.title")}
          </ExternalLink>
        </p>
      </footer>

      {/* Cloudflare Web Analytics */}
      {/*env.NODE_ENV === "production" && <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "2670b414c17d439c81ec294732f48bf8"}'></script>*/}
    </>
  );
}
