import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";

import { TRPCReactProvider } from "~/trpc/react";
import Footer from "~/app/_components/footer";
import { generateRootMetadata } from "~/lib/generate-metadata";

export const metadata = generateRootMetadata();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html 
      prefix="og: http://ogp.me/ns# fb: https://www.facebook.com/2008/fbml profile: http://ogp.me/ns/profile#"
      lang="en"
      className={`${GeistSans.variable}`}
    >
      <body className="bg-drossgray"> 
        <TRPCReactProvider>
          {children}
          <Footer english/>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
