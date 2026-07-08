import type { MetadataRoute } from "next";

// Web App Manifest (served at /manifest.webmanifest, and the <link rel="manifest">
// is injected automatically by Next's metadata system). Makes AIP:Aero installable
// as an app — handy on a cockpit/EFB tablet. Static route: no request-time work, so
// it prerenders and is served from the edge cache on Workers.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIP:Aero — AIP & approach charts",
    short_name: "AIP:Aero",
    description:
      "Find Aeronautical Information Publications (AIP), approach charts and airport data across Europe.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // drossblue — the primary brand color (see tailwind.config.ts).
    theme_color: "#2d6a9a",
    icons: [
      {
        src: "/aip-logo-450x450.jpg",
        sizes: "450x450",
        type: "image/jpeg",
      },
      {
        src: "/logo.webp",
        sizes: "any",
        type: "image/webp",
      },
    ],
  };
}
