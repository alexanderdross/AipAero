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
    dynamicIO: true,
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

export default withNextIntl(nextConfig);