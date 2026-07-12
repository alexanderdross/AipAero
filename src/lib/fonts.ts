import { Inter } from "next/font/google";

/**
 * Primary UI typeface. Loaded via next/font so it is self-hosted and inlined at
 * build time: no external request (important on the Cloudflare Workers runtime).
 * Exposed as the `--font-sans` CSS variable, which tailwind.config.ts wires into
 * `fontFamily.sans` (Inter first, Tahoma/Verdana as fallbacks). The `latin-ext`
 * subset covers the diacritics used by the Czech / Polish / Norwegian / Swedish
 * locales.
 *
 * `preload: false`: we do NOT emit `<link rel="preload">` for the font files.
 * Preloading triggered the browser "resource was preloaded but not used within
 * a few seconds" console warning (the woff2 files are referenced by CSS, not
 * needed for the first paint), and dropping the preload keeps them off the
 * critical request path.
 *
 * `display: "optional"` (was "swap"): without a preload the woff2 arrives
 * seconds after first paint, and the late swap re-wrapped every line that
 * breaks differently between Inter and the fallback - measured live on
 * 2026-07-12 as THE dominant CLS source (EDDF detail page: a 0.36 layout
 * shift; wrap-heavy runway/frequency rows). next/font's metric-adjusted
 * "Inter Fallback" (size-adjusted Arial) paints first and is close enough
 * that `optional` is the right trade: first visits on a cold cache keep the
 * fallback with ZERO late reflow, repeat visits render Inter from the cache.
 * Do not switch back to "swap" - it reintroduces the site-wide font CLS.
 */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "optional",
  preload: false,
});
