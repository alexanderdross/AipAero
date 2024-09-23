/** @type {import('next-sitemap').IConfig} */

const config = {
  siteUrl: process.env.SITE_URL || 'https://aip.aero',
  changefreq: 'weekly',
  exclude: ['/icon.png', '/apple-icon.png'],
  // ...other options
};

export default config;