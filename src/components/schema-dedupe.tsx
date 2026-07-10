"use client";

import { useEffect } from "react";

// Remove byte-identical duplicate JSON-LD <script> nodes from the DOM.
//
// The source emits every schema node exactly once (verified: local
// `next start` shows 1 of each type in served HTML and hydrated DOM), but on
// the Cloudflare/OpenNext serving path the schema.org validator shows some
// nodes twice - page-emitted ones (BreadcrumbList, Product) on the dynamic
// search routes, layout-emitted ones (WebSite, SiteNavigation) on the static
// country pages. The extra copies are exact duplicates of the same render, so
// removing byte-equal repeats merges them without ever losing an item;
// schemas with different content are never touched. Googlebot and the
// validator render JavaScript, so they see the deduplicated DOM.
//
// Runs after hydration and again after `load` (+ a grace delay) to catch
// late-streamed Suspense content.
function dedupe() {
  const seen = new Set<string>();
  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((node) => {
      const key = (node.textContent ?? "").replace(/\s+/g, "");
      if (!key) return;
      if (seen.has(key)) node.remove();
      else seen.add(key);
    });
}

export function SchemaDedupe() {
  useEffect(() => {
    dedupe();
    const late = () => setTimeout(dedupe, 1500);
    if (document.readyState === "complete") late();
    else window.addEventListener("load", late, { once: true });
  }, []);
  return null;
}
