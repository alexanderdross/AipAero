import type { Metadata, ResolvingMetadata } from 'next'
import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { Fragment } from "react";
import { AboutBox } from "~/components/about-box";
import { Box } from "~/components/box";
import Footer from "~/components/footer";
import { Title } from "~/components/title";
import { Header } from '~/components/header';

export async function generateMetadata(
  { params }: { params: Promise<{}> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const previousOpenGraph = (await parent).openGraph ?? {};

  return {
    title: '🛩️ Free AIP and Approach Charts for VFR, IFR & Heliports',
    description: '🛩️ Open Library for Aeronautical Information Publication (AIP) for VFR, IFR & Heliports.',
    openGraph: {
      ...previousOpenGraph,
      siteName: '🛩️ Free AIP and Approach Charts for VFR, IFR & Heliports',
    },
  }
}

export default async function RootPage() {
  setRequestLocale('uk');

  const countries = [
    {
      tld: 'uk',
      lang: 'en',
      name: 'United Kingdom',
      flag: '🇬🇧',
      nativeLang: 'English',
      isSingleLocale: true,
    },
    {
      tld: 'de',
      lang: 'de',
      name: 'Germany',
      flag: '🇩🇪',
      nativeLang: 'German',
    },
    {
      tld: 'nl',
      lang: 'nl',
      name: 'Netherlands',
      flag: '🇳🇱',
      nativeLang: 'Dutch',
    },
    {
      tld: 'at',
      lang: 'de',
      name: 'Austria',
      flag: '🇦🇹',
      nativeLang: 'German',
    }
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <html className="h-full" lang="en">

      {/* We cant set the alternate links via metadata api, since it disallows the use of duplicate hrefLang */}
      <head>
        {countries.map((e) => <link key={e.name} rel="alternate" hrefLang={e.lang} href={`https://aip.aero/${e.tld}/`} />)}
        {countries.filter(e => !e.isSingleLocale).map((e) => <link key={e.name} rel="alternate" hrefLang='en' href={`https://aip.aero/${e.tld}/en/`} />)}
      </head>

      <body className={'bg-drossgray font-sans'}>

        <Header />

        <Title
          title='Free AIP and Approach Charts for VFR, IFR & Heliports'
          description='Open Library for Aeronautical Information Publication (AIP) for VFR, IFR & Heliports.'
        />

        {/* Country Boxes */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={"grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
            {countries.map((e) => (
              <Box
                key={e.name}
                title={`AIP ${e.name} ${e.flag}`}
                description={`Browse AIP of ${e.name} and download airport approach charts`}
                buttons={e.isSingleLocale ? [
                  {
                    title: `AIP ${e.name} in ${e.nativeLang}`,
                    hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                    href: `/${e.tld}/`,
                  }
                ] : [
                  {
                    title: `AIP ${e.name} in English`,
                    hrefTitle: `AIP ${e.name} in English`,
                    href: `/${e.tld}/en/`,
                  },
                  {
                    title: `AIP ${e.name} in ${e.nativeLang}`,
                    hrefTitle: `AIP ${e.name} in ${e.nativeLang}`,
                    href: `/${e.tld}/`,
                  },
                ]}
              />
            ))}
          </div>
        </div>

        {/* About Box */}
        <AboutBox title="About this website" isH3={true}>
          This website aims to simplify the search for approach charts and Aeronautical Information Publication (AIP) for aerodromes, airports, and airfields in{' '}
          {countries.map((e, idx) => (<Fragment key={e.name}>
            <Link
              className="text-drossblue hover:underline"
              href={`/${e.tld}/`}
              title={`Aeronautical Information Publication (AIP) of ${e.name}`}
              target="_self"
              rel="noopener"
            >
              {e.name}
            </Link>
            {idx <= countries.length - 2 ? idx === countries.length - 2 ? ' and ' : ', ' : ''}
          </Fragment>))}
          . We are not liable for the correctness and accuracy of AIPs (Aeronautical Information Publication), as these are not operated by us. We merely provide convenient links to corresponding approach charts.
        </AboutBox>

        <Footer />
      </body>
    </html>
  );
}