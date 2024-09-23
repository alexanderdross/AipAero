import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";

import Footer from "~/app/_components/footer";
import { generateRootMetadata } from "~/lib/generate-metadata";
import { getTranslation } from "~/lib/i18n";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata = generateRootMetadata();

export default function Layout({ children }: { children: React.ReactNode }) {
  const translation = getTranslation({ tld: "uk", english: true });

  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="bg-drossgray">
        <TRPCReactProvider>
          {children}
          <Footer translation={translation.Footer} />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
