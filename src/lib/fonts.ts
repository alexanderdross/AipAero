import { Inter } from "next/font/google";

/**
 * Primary UI typeface. Loaded via next/font so it is self-hosted and inlined at
 * build time: no external request (important on the Cloudflare Workers runtime)
 * and no layout shift. Exposed as the `--font-sans` CSS variable, which
 * tailwind.config.ts wires into `fontFamily.sans` (Inter first, Tahoma/Verdana
 * as fallbacks). The `latin-ext` subset covers the diacritics used by the
 * Czech / Polish / Norwegian / Swedish locales.
 */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});
