"use client";

import { useEffect } from "react";

// localStorage index of recently viewed fields - read by favorites-recent.tsx.
const RECENT_KEY = "aip-recently-viewed";
const RECENT_MAX = 8;

export interface RecentEntry {
  slug: string;
  title: string;
  url: string;
  viewedAt: string;
}

/**
 * Records the current airport-detail view in the localStorage recents index
 * (pilot-wishlist "Favorites / recently viewed", the recents half - favorites
 * are the explicit offline saves). Renders nothing and does all work in a
 * post-hydration effect, so it adds no SSR bytes and nothing to the critical
 * path. Fail-soft everywhere (private mode / quota).
 */
export function RecentTracker({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  useEffect(() => {
    try {
      const url = window.location.pathname + window.location.search;
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
      const entries = Array.isArray(parsed) ? parsed : [];
      const next: RecentEntry[] = [
        { slug, title, url, viewedAt: new Date().toISOString() },
        // Dedupe on the URL (slug alone collides across countries/types).
        ...entries.filter((e) => e && e.url !== url),
      ].slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* fail-soft */
    }
  }, [slug, title]);

  return null;
}
