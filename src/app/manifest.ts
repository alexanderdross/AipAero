import type { MetadataRoute } from "next";

// Web App Manifest (served at /manifest.webmanifest, and the <link rel="manifest">
// is injected automatically by Next's metadata system). Makes AIP:Aero installable
// as an app - handy on a cockpit/EFB tablet. Static route: no request-time work, so
// it prerenders and is served from the edge cache on Workers.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIP:Aero - AIP & approach charts",
    short_name: "AIP:Aero",
    description:
      "Find Aeronautical Information Publications (AIP), approach charts and airport data across Europe.",
    // Stable app identity across start_url changes (recommended by Chromium).
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // drossblue - the primary brand color (see tailwind.config.ts).
    theme_color: "#2d6a9a",
    // Chromium's installability criteria require 192x192 AND 512x512 PNG icons;
    // a single 450x450 JPEG failed them (field-tested: no omnibox install icon,
    // no beforeinstallprompt). Generated from aip-logo-450x450.jpg, which stays
    // in public/ as the OG image. The maskable variant keeps the logo inside
    // the ~80% safe zone on a white canvas for adaptive Android icons.
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
