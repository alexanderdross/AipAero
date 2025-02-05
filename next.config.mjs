import createNextIntlPlugin from 'next-intl/plugin';
 
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
        source: '/2d6a9a/:slug/sitemap.xml',
        destination: '/2d6a9a/sitemaps/:slug/sitemap.xml',
      },
    ]
  },
};

export default withNextIntl(nextConfig);