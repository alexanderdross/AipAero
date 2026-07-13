"use client";

import { useEffect } from "react";

/**
 * Two-way hash <-> accordion binding for `<details>` sections (FAQ deep
 * links: #which-countries-are-covered etc.):
 *
 * - Arriving with (or navigating to) a hash OPENS the addressed accordion -
 *   CSS `:target` cannot expand a details element, so this tiny island is
 *   the one bit of JS the accordions need.
 * - OPENING an accordion writes its id into the URL hash (replaceState, no
 *   history spam), so the visible URL is always a shareable deep link. A
 *   link INSIDE the summary would be a nested interactive control (axe), so
 *   the toggle itself is the link-maker.
 *
 * Pure progressive enhancement: without JS the accordions still work, the
 * hash still scrolls to the (collapsed) question. Renders nothing.
 */
export function HashDetailsOpener() {
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const details = target?.closest("details");
      if (details && !details.open) details.open = true;
    };
    // `toggle` does not bubble - listen in the capture phase.
    const onToggle = (e: Event) => {
      const el = e.target as HTMLDetailsElement;
      if (el.tagName === "DETAILS" && el.open && el.id) {
        history.replaceState(null, "", `#${el.id}`);
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
