import { type Metadata } from "next";

export const orgUrl = new URL('https://aip.aero/');
export const orgLogo = new URL('/favicon/Suchmaske-Luftfahrthandbuch-AIP-Aeronautical-Information-Publication-VFR-IFR-Heliports-446x319.jpg', orgUrl);
export const orgLogoSquare = new URL('/favicon/Suchmaske-Luftfahrthandbuch-AIP-Aeronautical-Information-Publication-VFR-IFR-Heliports-450x450.jpg', orgUrl);
export const orgTitle = "🛩️ AIP and approach charts of Germany, Austria, the Netherlands";
export const orgDescription = "Free download of 🛩️ Aeronautical Information Publication (AIP) and approach charts of airports/ airfields in Germany, Austria, the Netherlands";
export const author = "Alexander Dross";
export const facebookId = "1378231674"
export const twitterAccount = "@alexanderdross"

export const generateRootMetadata = (): Metadata => {
  const metadata: Metadata = {
    title: orgTitle,
    description: orgDescription,
    abstract: orgDescription,
    robots: "index,follow,noodp,noydir",
    metadataBase: orgUrl,
    authors: [{ name: author }],
    publisher: author,
    facebook: {
      admins: facebookId,
    },
    icons: {
      icon: [
        { url: '/favicon/android-icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
        { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' }
      ],
      apple: [
        { url: '/favicon/apple-icon-57x57.png', sizes: '57x57', type: 'image/png' },
        { url: '/favicon/apple-icon-60x60.png', sizes: '60x60', type: 'image/png' },
        { url: '/favicon/apple-icon-72x72.png', sizes: '72x72', type: 'image/png' },
        { url: '/favicon/apple-icon-76x76.png', sizes: '76x76', type: 'image/png' },
        { url: '/favicon/apple-icon-114x114.png', sizes: '114x114', type: 'image/png' },
        { url: '/favicon/apple-icon-120x120.png', sizes: '120x120', type: 'image/png' },
        { url: '/favicon/apple-icon-144x144.png', sizes: '144x144', type: 'image/png' },
        { url: '/favicon/apple-icon-152x152.png', sizes: '152x152', type: 'image/png' },
        { url: '/favicon/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' },
      ]
    },
    openGraph: {
      url: orgUrl,
      siteName: orgTitle,
      type: "website",
      images: [
        {
          url: orgLogo.toString(),
          width: 446,
          height: 319,
          alt: "Logo",
          type: "image/jpg",
        }, {
          url: orgLogoSquare.toString(),
          width: 450,
          height: 450,
          alt: "Logo Quadratisch",
          type: "image/jpg",
        }
      ]
    },
    twitter:{
      card: "summary_large_image",
      site: twitterAccount,
    },
    alternates: {
      canonical: orgUrl,
      languages: {
        'x-default': 'https://aip.aero',
        'de-DE': 'https://aip.aero/de',
        'en-DE': 'https://aip.aero/de/en',
        'de-AT': 'https://aip.aero/at',
        'en-AT': 'https://aip.aero/at/en',
        'nl-NL': 'https://aip.aero/nl',
        'en-NL': 'https://aip.aero/nl/en',
      },
    },
  };
  return metadata;
}

export const generateMetadata = (
  title: string,
  description: string,
  url: string,
  canonicalUrl?: string,
): Metadata => {
  return {
    ...generateRootMetadata(),
    title: title,
    description: description,
    abstract: description,
    openGraph: {
      ...generateRootMetadata().openGraph,
      url: url,
    },
    alternates: {
      canonical: canonicalUrl ?? url,
    },
  };
}
