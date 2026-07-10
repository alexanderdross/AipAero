"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (`public/sw.js` - see
 * docs/pwa-offline-concept.md). Renders nothing.
 *
 * - Registered after the `load` event so it never competes with first paint
 *   (a Lighthouse-budget requirement).
 * - Skipped on localhost: `pnpm start`/`pnpm preview` and the Playwright E2E
 *   suite run there, and a SW would let cached pages leak between test
 *   scenarios. Production (aip.aero) and any deployed preview host register
 *   normally.
 * - `navigator.storage.persist()` asks the browser not to evict the caches
 *   under storage pressure - relevant for EFB tablets that go offline for
 *   hours (fail-soft; browsers may ignore it).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.storage?.persist?.())
        .catch(() => {
          /* fail-soft: the site works fully without the SW */
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
