import { Inter } from "next/font/google";

/**
 * Primary UI typeface. Loaded via next/font so it is self-hosted and inlined at
 * build time: no external request (important on the Cloudflare Workers runtime).
 * Exposed as the `--font-sans` CSS variable, which tailwind.config.ts wires into
 * `fontFamily.sans` (Inter first, Tahoma/Verdana as fallbacks). The `latin-ext`
 * subset covers the diacritics used by the Czech / Polish / Norwegian / Swedish
 * locales.
 *
 * `preload: false` + `display: "swap"`: we do NOT emit `<link rel="preload">`
 * for the font files. The Tahoma/Verdana fallback renders immediately and Inter
 * swaps in when its @font-face loads. Preloading here triggered the browser
 * "resource was preloaded but not used within a few seconds" console warning
 * (the woff2 files are referenced by CSS, not needed for the first paint), and
 * dropping the preload keeps them off the critical request path.
 */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
  preload: false,
});
