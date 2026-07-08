import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin();
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Content Security Policy — sent in Report-Only mode for now so violations
// are reported to the browser console / report-uri but the page still
// works. Watch for violations from AdSense over the next deploy cycle, then
// flip the header name to plain `Content-Security-Policy` to enforce.
//
// 'unsafe-inline' on script-src is needed for the inline <script
// type="application/ld+json"> blocks until those are migrated to nonces.
//
// Cloudflare Web Analytics: the beacon is loaded from
// static.cloudflareinsights.com and posts RUM data back to
// cloudflareinsights.com, so both origins are allowlisted on script-src /
// connect-src respectively.
//
// `upgrade-insecure-requests` is intentionally omitted: it is ignored in a
// Report-Only policy (and Chrome logs that as a console error). Re-add it
// when this policy is promoted to an enforcing `Content-Security-Policy`.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://pagead2.googlesyndication.com https://*.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.googlesyndication.com https://*.google.com",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://pagead2.googlesyndication.com",
  "frame-src https://googleads.g.doubleclick.net https://*.googlesyndication.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Report-Only: violations are surfaced but not blocked. Promote to
  // 'Content-Security-Policy' once the report stream is clean.
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
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
