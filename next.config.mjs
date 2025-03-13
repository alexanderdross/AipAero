import createNextIntlPlugin from 'next-intl/plugin';
import { withAxiomNextConfig } from 'next-axiom';
 
const withNextIntl = createNextIntlPlugin();

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
  async rewrites() {
    return [
      {
        source: '/2d6a9a/sitemap.xml',
        destination: '/2d6a9a/index.xml',
      },
    ]
  },
};

export default withAxiomNextConfig(withNextIntl(nextConfig));