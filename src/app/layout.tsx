import type { Metadata } from 'next'
import getConfig from 'next/config';
import { env } from '~/env';
import { orgUrl } from '~/lib/utils';

import "~/styles/globals.css";

const { publicRuntimeConfig } = getConfig() as { publicRuntimeConfig: { modifiedDate: string } };

export const metadata: Metadata = {
  metadataBase: orgUrl,
  authors: [{ name: 'Alexander Dross' }],
  publisher: 'Alexander Dross',
  robots: 'index,follow,noodp,noydir',
  facebook: {
    admins: '1378231674',
  },
  twitter: {
    site: '@alexanderdross',
  },
  openGraph: {
    type: 'website',
    images: [
      {
        url: '/aip-logo-446x319.jpg',
        alt: 'Logo',
        width: 446,
        height: 319,
        type: 'image/jpeg',
      },
      {
        url: '/aip-logo-450x450.jpg',
        alt: 'Logo Quadratisch',
        width: 450,
        height: 450,
        type: 'image/jpeg',
      }
    ]
  },
  other: {
    'google-adsense-account': `ca-pub-${env.ADSENSE_ID}`,
    'article:modified_time': publicRuntimeConfig.modifiedDate,
    'article:published_time': publicRuntimeConfig.modifiedDate
  }
}

// Since we have a `not-found.tsx` page on the root, a layout file
// is required, even if it's just passing children through.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}