import { Fragment } from 'react';
import { ExternalLink } from "~/components/external-link";
import { env } from "~/env";
import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('Footer');
  const keysTop = ['stratux', 'tradeaero'] as const;
  const keysMiddle = ['home', 'imprint', 'contact', 'privacy', 'madeBy'] as const;

  return (
    <>
      <footer className="max-w-7xl mx-auto py-8 px-4 overflow-hidden sm:px-6 lg:px-8">

        {/* Top links */}
        <div className="px-5 py-2 flex flex-wrap justify-center gap-x-2">
          {keysTop.map((key, idx) => (
            <Fragment key={idx}>
              <ExternalLink
                href={t(`${key}.href`)}
                hrefTitle={t(`${key}.hrefTitle`)}
                className="text-base text-drossblue hover:underline mx-2"
              >
                {t(`${key}.title`)}
              </ExternalLink>{idx < keysTop.length - 1 && '|'}
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
                className="text-base text-drossblue hover:underline mx-2"
              >
                {t(`${key}.title`)}
              </ExternalLink>{idx < keysMiddle.length - 1 && '|'}
            </Fragment>
          ))}
        </div>

        {/* Bottom */}
        <p className="mt-2 text-center text-base text-drossgray-dark">&copy; {new Date().getFullYear()} made with ♥ by
          <ExternalLink
            href={t('madeBy.href')}
            hrefTitle={t('madeBy.hrefTitle')}
            className="text-base text-drossblue hover:underline mx-2"
          >
            {t('madeBy.title')}
          </ExternalLink>
        </p>
      </footer>
      
      {/* Cloudflare Web Analytics */}
      {env.NODE_ENV === "production" && <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "2670b414c17d439c81ec294732f48bf8"}'></script>}
    </>
  )
}