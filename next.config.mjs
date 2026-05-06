import createNextIntlPlugin from 'next-intl/plugin';
import { withAxiomNextConfig } from 'next-axiom';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin();
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Conservative security headers. CSP is intentionally not set here yet:
// inline JSON-LD blocks, AdSense, and Axiom each need careful nonce/origin
// allow-listing, and getting that wrong silently breaks the page. Track
// CSP separately.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  trailingSlash: true,
  publicRuntimeConfig: {
    modifiedDate: new Date().toISOString(),
  },
  experimental: {
    useCache: true,
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

export default withAnalyzer(withAxiomNextConfig(withNextIntl(nextConfig)));