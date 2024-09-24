import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";

import Footer from "~/app/_components/footer";
import { generateRootMetadata } from "~/lib/generate-metadata";
import { getTranslation } from "~/lib/i18n";

export const metadata = generateRootMetadata();

export default function Layout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // Use the UK translation for the footer (any english translation would work)
  const translation = getTranslation({ tld: "uk", english: true });

  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="bg-drossgray">
        {children}
        <Footer translation={translation.Footer} />
      </body>
    </html>
  );
}
