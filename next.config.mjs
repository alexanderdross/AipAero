import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin();
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Content Security Policy — ENFORCED (promoted from Report-Only after the
// report stream came back clean; the pilot-wishlist security item).
//
// 'unsafe-inline' on script-src is needed for the inline <script
// type="application/ld+json"> blocks until those are migrated to nonces.
//
// Cloudflare Web Analytics: the beacon is loaded from
// static.cloudflareinsights.com and posts RUM data back to
// cloudflareinsights.com, so both origins are allowlisted on script-src /
// connect-src respectively.
//
// AdSense needs, per Google's published CSP guidance for ads: script-src
// pagead2.googlesyndication.com + tpc.googlesyndication.com +
// googleads.g.doubleclick.net, frames on googleads.g.doubleclick.net /
// *.googlesyndication.com, and the *.adtrafficquality.google verification
// endpoints on script/frame/img/connect. Enforcing without these blanks ad
// slots (revenue), so they are allowlisted up front, not reactively.
//
// object-src: the chart box's inline PDF preview embeds the approach chart
// from the national AIP hosts via <object> (chart-preview.tsx). Those hosts
// are many and change per AIRAC cycle, so they cannot be enumerated -
// `object-src https:` restricts embeds to HTTPS while keeping the preview
// working. ('none' would silently break it on every detail page.)
// Cloudflare Turnstile (contact form, /contact + /de/kontakt) loads its script
// from challenges.cloudflare.com, renders the challenge in an iframe from the
// same origin, and posts back to it - so challenges.cloudflare.com must be on
// script-src, frame-src and connect-src.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://*.adtrafficquality.google https://*.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://*.adtrafficquality.google",
  "frame-src https://challenges.cloudflare.com https://googleads.g.doubleclick.net https://*.googlesyndication.com https://*.adtrafficquality.google",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src https:",
  // Offline service worker (public/sw.js) - explicit, so the enforcing
  // policy cannot silently break SW registration.
  "worker-src 'self'",
  // Only meaningful in an enforcing policy (ignored + console-noise in
  // Report-Only, which is why it was omitted before the promotion).
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // geolocation=(self): the airport-list map's "locate me" button needs it
    // for our own origin. An empty allowlist (geolocation=()) blocks it site-
    // wide, so the button silently fails. camera/microphone stay disabled.
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  },
  // Enforcing (promoted from Content-Security-Policy-Report-Only). If a
  // legitimate resource ever gets blocked, extend the allowlist above -
  // do NOT fall back to Report-Only.
  { key: 'Content-Security-Policy', value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  experimental: {
    // Inline each page's CSS as a <style> in <head> instead of external
    // <link rel="stylesheet"> requests. Removes the render-blocking CSS round
    // trip (Lighthouse "render-blocking requests") and, because there is no
    // external CSS file to preload, also removes the "resource was preloaded
    // but not used" console warnings from route prefetching. The inlined CSS
    // (~10 KiB gzipped) is a negligible per-request cost now that the heavy
    // airport-list markers are fetched client-side (not serialised into SSR).
    inlineCss: true,
  },
  // Emit metadata blocking in <head> for every request instead of streaming
  // it. Since Next 15.2 metadata is streamed for non-bot user agents, so on
  // dynamically rendered routes (the search / airport-detail pages, which read
  // searchParams for the ?ICAO SEO scheme) the <meta name="description">, OG
  // and Twitter tags land in <body> and are only hoisted to <head> by client
  // JS. Crawlers and Lighthouse then see no description in <head>. Matching all
  // user agents with `htmlLimitedBots` forces blocking, in-<head> metadata for
  // everyone. The cost is a small TTFB increase on dynamic pages (generateMetadata
  // resolves before the first byte) — the right trade for these SEO pages.
  htmlLimitedBots: /.*/,
  // The Cloudflare Workers runtime does not run the default Next.js image
  // optimizer (sharp). The few assets we serve are already sized, so skip it.
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The service worker must revalidate on every load so a deploy's new
        // SW is picked up promptly (browsers honor Cache-Control here).
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/2d6a9a/sitemap.xml',
        destination: '/2d6a9a/index.xml',
      },
    ]
  },
};

export default withAnalyzer(withNextIntl(nextConfig));

// Enable getCloudflareContext() (D1 binding access) during `next dev`.
// No-op outside the Cloudflare dev flow.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
