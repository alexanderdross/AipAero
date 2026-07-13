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
 * from localStorage (pilot-wishlist item; no account needed), presented as a
 * content card matching the page's card language (owner decision 13.07.2026).
 * Client-only by nature - the data is personal and must never be in the
 * indexable SSR HTML; the card mounts only after hydration (`loaded`), so the
 * placeholder copy stays out of the crawlable HTML too. Empty sections show a
 * feature-discovery placeholder instead of hiding (owner request 13.07.2026):
 * first-time visitors learn that saving/opening fields populates these lists.
 * Web-performance guard rails: rendered below the country cards (above the
 * about box - owner decision: returning pilots reach their fields without
 * scrolling past first-timer content), which is still below the initial fold
 * for virtually all viewports, so the post-hydration appearance costs no
 * LCP/CLS on the indexable content.
 */
export function FavoritesRecent({
  favoritesLabel,
  recentLabel,
  favoritesEmptyLabel,
  recentEmptyLabel,
}: {
  favoritesLabel: string;
  recentLabel: string;
  favoritesEmptyLabel: string;
  recentEmptyLabel: string;
}) {
  const [loaded, setLoaded] = useState(false);
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
    setLoaded(true);
  }, []);

  // No pre-hydration render: personal lists and the placeholder copy both
  // stay out of the served SSR HTML (SEO pages remain byte-identical).
  if (!loaded) return null;

  const section = (
    label: string,
    entries: LinkEntry[],
    icon: React.ReactNode,
    emptyLabel: string,
  ) => (
    // Full width on mobile so both stacked sections share one left edge;
    // side-by-side from sm up, capped so empty-state copy wraps nicely.
    <section className="w-full sm:w-64">
      <h2 className="inline-flex items-center gap-x-1 text-base font-medium">
        {icon}
        <span>{label}</span>
      </h2>
      {entries.length > 0 ? (
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
      ) : (
        <p className="text-drossgray-dark mt-1">{emptyLabel}</p>
      )}
    </section>
  );

  return (
    // mt-6, not mt-16: the Trade:Aero CTA above already carries py-10, so a
    // full section margin stacked to ~104px while the about box below sits at
    // 64px (owner-spotted imbalance) - 24px + the CTA's 40px restores the
    // page's uniform ~64px section rhythm.
    <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6 lg:px-8">
      <div className="border-drossgray-dark/15 rounded-xl border bg-white p-6 text-sm shadow-sm sm:p-8">
        <div className="flex flex-wrap justify-center gap-x-16 gap-y-6 text-left">
          {section(
            favoritesLabel,
            favorites,
            <StarIcon className="size-4 flex-shrink-0" aria-hidden="true" />,
            favoritesEmptyLabel,
          )}
          {section(
            recentLabel,
            recent,
            <HistoryIcon className="size-4 flex-shrink-0" aria-hidden="true" />,
            recentEmptyLabel,
          )}
        </div>
      </div>
    </div>
  );
}
