"use client";

import { HistoryIcon, StarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { RecentEntry } from "~/components/recent-tracker";

// Index keys shared with save-offline-button.tsx (favorites = the explicitly
// saved fields, per the PWA concept: one implementation for both) and
// recent-tracker.tsx.
const SAVED_KEY = "aip-offline-saved";
const RECENT_KEY = "aip-recently-viewed";
const SHOW_MAX = 8;

interface LinkEntry {
  url: string;
  title: string;
}

function readEntries(key: string): LinkEntry[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.url === "string")
      .map((e) => ({ url: e.url, title: e.title || e.url }));
  } catch {
    return [];
  }
}

/**
 * Personal "Favorites" (the offline-saved fields) and "Recently viewed" lists
 * from localStorage (pilot-wishlist item; no account needed). Client-only by
 * nature - the data is personal and must never be in the indexable SSR HTML.
 * Web-performance guard rails: rendered below the country cards (above the
 * about box - owner decision 13.07.2026: returning pilots reach their fields
 * without scrolling past first-timer content), which is still below the
 * initial fold for virtually all viewports, so the post-hydration appearance
 * costs no LCP/CLS on the indexable content; renders nothing for first-time
 * visitors.
 */
export function FavoritesRecent({
  favoritesLabel,
  recentLabel,
}: {
  favoritesLabel: string;
  recentLabel: string;
}) {
  const [favorites, setFavorites] = useState<LinkEntry[]>([]);
  const [recent, setRecent] = useState<LinkEntry[]>([]);

  useEffect(() => {
    const favs = readEntries(SAVED_KEY).slice(0, SHOW_MAX);
    const favUrls = new Set(favs.map((f) => f.url));
    setFavorites(favs);
    // Recents exclude fields already shown as favorites, and dedupe on the
    // title: the tracker keys on the full URL, so the same field viewed via
    // its native AND English locale URL is stored twice - one row per field.
    const seenTitles = new Set<string>();
    setRecent(
      readEntries(RECENT_KEY)
        .filter((e) => !favUrls.has(e.url))
        .filter((e) =>
          seenTitles.has(e.title) ? false : (seenTitles.add(e.title), true),
        )
        .slice(0, SHOW_MAX),
    );
  }, []);

  if (favorites.length === 0 && recent.length === 0) return null;

  const section = (
    label: string,
    entries: LinkEntry[],
    icon: React.ReactNode,
  ) =>
    entries.length > 0 && (
      // Full width on mobile so both stacked sections share one left edge
      // (justify-center used to center each block by its own width - the
      // two headlines did not align); side-by-side and centered from sm up.
      <section className="w-full sm:w-auto">
        <h2 className="inline-flex items-center gap-x-1 text-base font-medium">
          {icon}
          <span>{label}</span>
        </h2>
        <ul className="mt-1">
          {entries.map((e) => (
            <li key={e.url}>
              <a
                href={e.url}
                title={e.title}
                className="text-drossblue inline-block py-0.5 hover:underline"
              >
                {e.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-4 text-sm sm:px-6 lg:px-8">
      <div className="flex flex-wrap justify-center gap-x-16 gap-y-6 text-left">
        {section(
          favoritesLabel,
          favorites,
          <StarIcon className="size-4 flex-shrink-0" aria-hidden="true" />,
        )}
        {section(
          recentLabel,
          recent,
          <HistoryIcon className="size-4 flex-shrink-0" aria-hidden="true" />,
        )}
      </div>
    </div>
  );
}
