"use client";

import {
  CheckIcon,
  DownloadIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { promptInstall } from "~/lib/install-prompt";

// One cache per locale (`bulk-<locale>-v1`), never trimmed, replaced wholesale
// on re-download. Prefix + version must stay in sync with public/sw.js.
const BULK_VERSION = "v1";
const bulkCacheName = (locale: string) => `bulk-${locale}-${BULK_VERSION}`;
// localStorage index of downloaded country packs (offline.html lists them) -
// key must stay in sync with public/offline.html.
const INDEX_KEY = "aip-offline-bulk";

// ~75 KB per stored detail page (inlineCss HTML, uncompressed in Cache
// Storage) - the concept doc's estimate (~60 MB for the ~800 DE pages). Used
// for the pre-download quota guard; the server-rendered size hint on the
// button label uses the same figure (see airport-list/page.tsx).
const EST_BYTES_PER_PAGE = 75 * 1024;

// STRICTLY sequential: every detail page is a dynamic Worker render, and on
// the Workers Free plan (10 ms CPU/request, burst-tolerated) even 3 sustained
// concurrent renders exhausted the burst budget - a single DE pack download
// caused a sitewide exceededCpu storm (1,492 Error-1102s, observed live
// 13.07.2026, Ray a1aaa7516b4dd2cb). Do not raise this above 1 while the
// Worker runs on the Free plan.
const CONCURRENCY = 1;

// Breather between pages - keeps the pack download from being a continuous
// CPU drain on the Worker (see the incident above).
const PAGE_DELAY_MS = 250;

// Per-page fetch timeout: without one, a single stalled connection hangs its
// worker forever - three stalls froze the whole DE download at 126/793
// (observed live 13.07.2026). One retry follows before the page is skipped.
const PAGE_TIMEOUT_MS = 30_000;

// Cooperative backoff: a 5xx means the Worker is struggling (usually the CPU
// limit) - pause long before the single retry instead of piling on, and give
// up on the whole download after this many consecutive failed pages rather
// than hammering a degraded production for hundreds more requests.
const SERVER_ERROR_BACKOFF_MS = 8_000;
const MAX_CONSECUTIVE_FAILURES = 10;

interface BulkEntry {
  url: string;
  title: string;
  count: number;
  savedAt: string;
}

type BulkIndex = Record<string, BulkEntry>;

function readIndex(): BulkIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as BulkIndex) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeIndex(index: BulkIndex) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* quota / private mode: fail-soft */
  }
}

/**
 * Explicit country bulk download (PWA concept Phase 4): saves ALL of the
 * country's airport-detail pages (plus this list page) for offline use - HTML
 * only, never chart PDFs (opaque no-cors responses carry ~7 MB quota padding
 * each, so bulk PDF caching is a quota non-starter; PDFs stay per-field via
 * the save-offline button). The URL list comes from GET /api/airport-urls on
 * click; pages land in the per-locale `bulk-<locale>-v1` cache (served by the
 * SW navigation fallback with the dated offline banner). A quota guard checks
 * `navigator.storage.estimate()` before starting, progress is shown per page,
 * and cancel deletes the partial pack. Re-download overwrites in place and
 * prunes pages that left the source. Renders nothing where Cache Storage is
 * unavailable; all fail-soft.
 */
export function SaveCountryOfflineButton({
  locale,
  downloadLabel,
  downloadedLabel,
  updateLabel,
  removeLabel,
  progressLabel,
  cancelLabel,
  errorLabel,
  noSpaceLabel,
}: {
  locale: string;
  downloadLabel: string;
  downloadedLabel: string;
  updateLabel: string;
  removeLabel: string;
  progressLabel: string;
  cancelLabel: string;
  errorLabel: string;
  noSpaceLabel: string;
}) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [saved, setSaved] = useState<BulkEntry | null>(null);
  const [error, setError] = useState<"failed" | "nospace" | null>(null);
  const cancelRef = useRef(false);
  // Cancel must ABORT in-flight requests, not just stop the queue - a hung
  // fetch would otherwise keep its worker (and the busy state) alive.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!("caches" in window)) return;
    setSupported(true);
    setSaved(readIndex()[locale] ?? null);
  }, [locale]);

  async function download() {
    cancelRef.current = false;
    setBusy(true);
    setError(null);
    setProgress(null);
    // Bulk-saving a country implies wanting the app on the device - same
    // reasoning as the per-field save button: fire the native install prompt
    // inside this user gesture (no-op on iOS / when already installed).
    void promptInstall();
    try {
      // Trailing slash: the app sets `trailingSlash: true`, so the slashless
      // URL 308-redirects - request the canonical form directly to skip that
      // hop (same as the map's coords fetch).
      const res = await fetch(
        `/api/airport-urls/?locale=${encodeURIComponent(locale)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const detailUrls = (await res.json()) as string[];
      if (!Array.isArray(detailUrls) || detailUrls.length === 0) {
        throw new Error("empty url list");
      }
      const listUrl = window.location.pathname + window.location.search;
      const urls = [listUrl, ...detailUrls];

      // Quota guard: refuse before downloading megabytes into a full device.
      const estimate = await navigator.storage
        ?.estimate?.()
        .catch(() => undefined);
      if (
        estimate?.quota != null &&
        estimate.usage != null &&
        estimate.quota - estimate.usage < urls.length * EST_BYTES_PER_PAGE
      ) {
        setError("nospace");
        return;
      }

      const cache = await caches.open(bulkCacheName(locale));
      setProgress({ done: 0, total: urls.length });
      let done = 0;
      let savedCount = 0;
      const queue = [...urls];
      const controller = new AbortController();
      abortRef.current = controller;
      // Timeout per request AND linked to the cancel controller - a stalled
      // connection is aborted after PAGE_TIMEOUT_MS instead of hanging its
      // worker (broad-support variant of AbortSignal.any/timeout).
      const fetchWithTimeout = (href: string) => {
        const ctl = new AbortController();
        const onCancel = () => ctl.abort();
        controller.signal.addEventListener("abort", onCancel, { once: true });
        const timer = setTimeout(() => ctl.abort(), PAGE_TIMEOUT_MS);
        return fetch(href, { signal: ctl.signal }).finally(() => {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", onCancel);
        });
      };
      const sleep = (ms: number) =>
        new Promise((r) => {
          const timer = setTimeout(r, ms);
          // Cancel cuts the pause short too - no lingering busy state.
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              r(undefined);
            },
            { once: true },
          );
        });
      // Consecutive pages that ended in a 5xx or a network failure/timeout -
      // the overload signal for the give-up guard (a 404 does not count: a
      // removed airport is not server distress). Single worker, so no races.
      let consecutiveFailures = 0;
      let overloaded = false;
      const worker = async () => {
        for (;;) {
          const href = queue.shift();
          if (href === undefined || cancelRef.current || overloaded) return;
          try {
            // One retry per page: dynamic Worker renders can transiently
            // fail/stall. A 5xx gets the LONG cooperative pause (the Worker
            // is at its CPU limit); a plain network error a short one.
            let page: Response | undefined;
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                page = await fetchWithTimeout(href);
              } catch {
                page = undefined;
              }
              if (cancelRef.current) return;
              if (page && page.status < 500) break;
              if (attempt === 0) {
                await sleep(
                  page && page.status >= 500 ? SERVER_ERROR_BACKOFF_MS : 1000,
                );
              }
            }
            if (page?.ok) {
              consecutiveFailures = 0;
              // Stamp the cache time so the SW's offline banner can date the
              // copy (aviation rule: cached content is never silently stale).
              const headers = new Headers(page.headers);
              headers.set("sw-cached-at", new Date().toUTCString());
              headers.delete("Content-Length");
              await cache.put(
                href,
                new Response(await page.blob(), {
                  status: page.status,
                  headers,
                }),
              );
              savedCount++;
            } else if (!page || page.status >= 500) {
              consecutiveFailures++;
              if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                overloaded = true;
              }
            }
          } catch {
            /* single page unreachable: skip, keep the rest */
          }
          done++;
          setProgress({ done, total: urls.length });
          if (queue.length > 0 && !cancelRef.current && !overloaded) {
            await sleep(PAGE_DELAY_MS);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      abortRef.current = null;

      if (overloaded && !cancelRef.current) {
        // Server-side overload abort: drop the partial pack (like cancel) and
        // surface the generic error - retrying later is the right move.
        await caches.delete(bulkCacheName(locale));
        const index = readIndex();
        delete index[locale];
        writeIndex(index);
        setSaved(null);
        throw new Error("aborted: server overload");
      }

      if (cancelRef.current) {
        // Cancel = no pack: drop the partial cache and its index entry.
        await caches.delete(bulkCacheName(locale));
        const index = readIndex();
        delete index[locale];
        writeIndex(index);
        setSaved(null);
        return;
      }
      if (savedCount === 0) throw new Error("all page fetches failed");

      // Re-download path: prune pages that are no longer in the source list
      // (an airport removed upstream must not linger as a stale offline copy).
      const wanted = new Set(
        urls.map((u) => new URL(u, window.location.href).href),
      );
      for (const key of await cache.keys()) {
        if (!wanted.has(key.url)) await cache.delete(key);
      }

      // Ask the browser not to evict the pack (EFB use; may be ignored).
      void navigator.storage?.persist?.();

      const entry: BulkEntry = {
        url: listUrl,
        title: document.title,
        count: savedCount,
        savedAt: new Date().toISOString(),
      };
      writeIndex({ ...readIndex(), [locale]: entry });
      setSaved(entry);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await caches.delete(bulkCacheName(locale));
      const index = readIndex();
      delete index[locale];
      writeIndex(index);
      setSaved(null);
      setError(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    // Rendered from SSR on with a reserved row height; the interactive content
    // mounts after hydration. Returning null until mounted inserted the row
    // post-hydration and shifted the airport list below it (CLS) - same fix
    // as the per-field save button.
    <div className="mx-auto min-h-6 max-w-7xl px-4 pb-6 text-center text-sm sm:px-6 lg:px-8">
      {!supported ? null : busy && progress ? (
        <p className="text-drossgray-dark inline-flex items-center gap-x-2">
          <span>
            {progressLabel} {progress.done}/{progress.total}
          </span>
          <button
            type="button"
            onClick={() => {
              cancelRef.current = true;
              abortRef.current?.abort();
            }}
            title={cancelLabel}
            className="text-drossblue inline-flex items-center gap-x-1 hover:underline"
          >
            <XIcon className="size-4 flex-shrink-0" aria-hidden="true" />
            <span>{cancelLabel}</span>
          </button>
        </p>
      ) : saved ? (
        <p className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span className="text-drossgray-dark inline-flex items-center gap-x-1">
            <CheckIcon className="size-4 flex-shrink-0" aria-hidden="true" />
            <span>
              {downloadedLabel} ({saved.count},{" "}
              {new Date(saved.savedAt).toLocaleDateString()})
            </span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={download}
            title={updateLabel}
            className="text-drossblue inline-flex items-center gap-x-1 hover:underline disabled:opacity-50"
          >
            <RefreshCwIcon
              className="size-4 flex-shrink-0"
              aria-hidden="true"
            />
            <span>{updateLabel}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            title={removeLabel}
            className="text-drossblue inline-flex items-center gap-x-1 hover:underline disabled:opacity-50"
          >
            <Trash2Icon className="size-4 flex-shrink-0" aria-hidden="true" />
            <span>{removeLabel}</span>
          </button>
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={download}
          title={downloadLabel}
          className="text-drossblue inline-flex items-center gap-x-1 hover:underline disabled:opacity-50"
        >
          <DownloadIcon className="size-4 flex-shrink-0" aria-hidden="true" />
          <span>{downloadLabel}</span>
        </button>
      )}
      {error && (
        <p className="text-drossgray-dark mx-auto mt-1 max-w-md text-xs">
          {error === "nospace" ? noSpaceLabel : errorLabel}
        </p>
      )}
    </div>
  );
}
