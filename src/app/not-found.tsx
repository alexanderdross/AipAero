import Link from "next/link";
import { GlobalSearchInputField } from "~/components/global-search-input-field";
import { inter } from "~/lib/fonts";

// Catches URLs outside the locale tree (e.g. /nope/). English-only, like the
// global homepage; the locale-aware variant lives in [locale]/not-found.tsx.
// Owns <html>/<body> because the root layout passes children through.
export default function NotFound() {
  return (
    <html className={`h-full ${inter.variable}`} lang="en">
      <body className="bg-drossgray flex h-full flex-col items-center justify-center gap-4 px-4 py-16 text-center font-sans">
        <h1 className="text-2xl font-bold">404 - Page not found</h1>
        <p className="text-drossgray-dark">
          This page or airport code does not exist. Try searching for the
          airport instead:
        </p>
        <div className="w-full max-w-2xl">
          <GlobalSearchInputField placeholder="Search any airport by name or ICAO code" />
        </div>
        <Link href="/" className="text-drossblue underline hover:no-underline">
          Back to the home page
        </Link>
      </body>
    </html>
  );
}
