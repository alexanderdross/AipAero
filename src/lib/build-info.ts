// Build timestamp used for sitemap <lastmod> and OpenGraph modified/published
// times. Previously derived from `publicRuntimeConfig.modifiedDate`
// (`new Date()` evaluated once when next.config loaded), which relies on the
// legacy `next/config` API that the Cloudflare/OpenNext adapter does not
// support. We stamp it via `NEXT_PUBLIC_BUILD_DATE` at build time (see the
// `build`/`preview`/`deploy` scripts) and fall back to the current time.
export const modifiedDate =
  process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString();
