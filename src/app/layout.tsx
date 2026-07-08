import type { Metadata } from "next";
import { env } from "~/env";
import { orgUrl } from "~/lib/utils";
import { modifiedDate } from "~/lib/build-info";

import "~/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: orgUrl,
  authors: [{ name: "Alexander Dross" }],
  publisher: "Alexander Dross",
  robots: "index,follow,noodp,noydir",
  facebook: {
    admins: "1378231674",
  },
  twitter: {
    card: "summary_large_image",
    site: "@alexanderdross",
    creator: "@alexanderdross",
  },
  openGraph: {
    type: "website",
    images: [
      {
        url: "/aip-logo-446x319.jpg",
        width: 446,
        height: 319,
        type: "image/jpeg",
      },
      {
        url: "/aip-logo-450x450.jpg",
        width: 450,
        height: 450,
        type: "image/jpeg",
      },
    ],
  },
  other: {
    "google-adsense-account": `ca-pub-${env.ADSENSE_ID}`,
    "article:modified_time": modifiedDate,
    "article:published_time": modifiedDate,
    "og:updated_time": modifiedDate,
  },
};

// Since we have a `not-found.tsx` page on the root, a layout file
// is required, even if it's just passing children through.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
