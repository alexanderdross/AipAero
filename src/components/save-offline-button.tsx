"use client";

import { CheckIcon, DownloadIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  isIos,
  isMacSafari,
  isStandalone,
  promptInstall,
} from "~/lib/install-prompt";

// Cache names must stay in sync with public/sw.js (SAVED_CACHE / CHARTS_CACHE).
const SAVED_CACHE = "saved-v1";
const CHARTS_CACHE = "charts-v1";
// localStorage index of saved fields - doubles as the Favorites list (see
// docs/pwa-offline-concept.md, Phase 3).
const INDEX_KEY = "aip-offline-saved";

interface SavedEntry {
  slug: string;
  title: string;
  url: string;
  chartUrl: string | null;
  savedAt: string;
}

function readIndex(): SavedEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: SavedEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode: fail-soft */
  }
}

/**
 * Explicit "save for offline" for an airport-detail page (PWA concept Phase 3):
 * stores the page HTML in the never-trimmed `saved-v1` cache (stamped with
 * `sw-cached-at` so the offline banner can show its age) and, when the chart is
 * a direct PDF, the PDF as an opaque `no-cors` response in `charts-v1` (served
 * by the SW for the inline preview embed when offline). The saved fields are
 * indexed in localStorage - the Favorites foundation. Renders nothing where
 * Cache Storage is unavailable. All fail-soft: an error resets to unsaved.
 */
export function SaveOfflineButton({
  slug,
  title,
  chartUrl,
  saveLabel,
  savedLabel,
  installHintLabel,
  installHintMacLabel,
}: {
  slug: string;
  title: string;
  chartUrl: string | null;
  saveLabel: string;
  savedLabel: string;
  installHintLabel: string;
  installHintMacLabel: string;
}) {
  const [supported, setSupported] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  // Which manual-install hint to show after saving: Apple platforms have no
  // programmatic install ("ios" = Share -> Add to Home Screen, "mac" = Safari
  // Share -> Add to Dock); Chromium platforms get the native prompt instead.
  const [manualHint, setManualHint] = useState<"ios" | "mac" | null>(null);

  useEffect(() => {
    if (!("caches" in window)) return;
    setSupported(true);
    setSaved(readIndex().some((e) => e.slug === slug));
  }, [slug]);

  async function save() {
    setBusy(true);
    // Saving for offline implies wanting the app on the device: trigger the
    // NATIVE install dialog right inside this user gesture (Chromium/Android;
    // resolves "unavailable" when already installed or unsupported). Fired
    // before the async cache work so the transient user activation is still
    // valid. iOS has no programmatic install - a manual Add-to-Home-Screen
    // hint is shown after saving instead.
    void promptInstall();
    try {
      const pageUrl = window.location.pathname + window.location.search;
      const res = await fetch(pageUrl);
      if (!res.ok) throw new Error(String(res.status));
      const headers = new Headers(res.headers);
      headers.set("sw-cached-at", new Date().toUTCString());
      headers.delete("Content-Length");
      const stamped = new Response(await res.blob(), {
        status: res.status,
        headers,
      });
      const savedCache = await caches.open(SAVED_CACHE);
      await savedCache.put(pageUrl, stamped);

      if (chartUrl) {
        try {
          // CORS first: a readable response stores at its REAL size. Only
          // when the AIP host sends no CORS headers (the common case) fall
          // back to an opaque no-cors response - it still serves offline,
          // but Cache Storage pads opaque entries (~7 MB quota each, see
          // docs/pwa-offline-concept.md), so avoid it where possible.
          const charts = await caches.open(CHARTS_CACHE);
          let pdf: Response | null = null;
          try {
            const res = await fetch(chartUrl);
            if (res.ok) pdf = res;
          } catch {
            /* no CORS on the chart host - use the opaque fallback */
          }
          pdf ??= await fetch(chartUrl, { mode: "no-cors" });
          await charts.put(chartUrl, pdf);
        } catch {
          /* chart host unreachable: the page is still saved */
        }
      }

      // Ask the browser not to evict the saved data (EFB use; may be ignored).
      void navigator.storage?.persist?.();

      const index = readIndex().filter((e) => e.slug !== slug);
      index.push({
        slug,
        title,
        url: pageUrl,
        chartUrl,
        savedAt: new Date().toISOString(),
      });
      writeIndex(index);
      setSaved(true);
      if (!isStandalone()) {
        if (isIos()) setManualHint("ios");
        else if (isMacSafari()) setManualHint("mac");
      }
    } catch {
      setSaved(false);
    } finally {
      setBusy(false);
    }
  }

  async function unsave() {
    setBusy(true);
    try {
      const pageUrl = window.location.pathname + window.location.search;
      const savedCache = await caches.open(SAVED_CACHE);
      await savedCache.delete(pageUrl);
      if (chartUrl) {
        const charts = await caches.open(CHARTS_CACHE);
        await charts.delete(chartUrl);
      }
      writeIndex(readIndex().filter((e) => e.slug !== slug));
      setSaved(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    // The container renders from SSR on (min-h reserves the row) and only the
    // button mounts after hydration: `if (!supported) return null` inserted
    // the row post-hydration and pushed the whole gadget region down - a
    // measured in-viewport layout shift on every detail view (CLS). The rare
    // no-Cache-Storage browser just keeps a 24px blank line instead.
    <div className="min-h-6 text-center text-sm">
      {supported && (
        <button
          type="button"
          disabled={busy}
          onClick={saved ? unsave : save}
          title={saved ? savedLabel : saveLabel}
          className="text-drossblue inline-flex items-center gap-x-1 hover:underline disabled:opacity-50"
        >
          {saved ? (
            <CheckIcon className="size-4 flex-shrink-0" aria-hidden="true" />
          ) : (
            <DownloadIcon className="size-4 flex-shrink-0" aria-hidden="true" />
          )}
          <span>{saved ? savedLabel : saveLabel}</span>
        </button>
      )}
      {/* Apple platforms cannot install programmatically: after saving, show
          the manual route (hidden when already running as an installed app). */}
      {manualHint && (
        <p className="text-drossgray-dark mx-auto mt-1 max-w-md text-xs">
          {manualHint === "ios" ? installHintLabel : installHintMacLabel}
        </p>
      )}
    </div>
  );
}
