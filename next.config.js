/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  trailingSlash: true,
  publicRuntimeConfig: {
    modifiedDate: new Date().toISOString(),
  },
  async rewrites() {
    return [
      {
        source: '/:slug/sitemap.xml',
        destination: '/sitemaps/:slug/sitemap.xml',
      },
    ]
  },
};

export default config;
