/** @type {import('next-sitemap').IConfig} */

const config = {
  siteUrl: process.env.SITE_URL || 'https://aip.aero',
  changefreq: 'weekly',
  // ...other options
};

export default config;