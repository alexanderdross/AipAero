"use client";

import { useEffect } from "react";

/**
 * First-party client-error reporter. Renders nothing. Listens for uncaught
 * `error` and `unhandledrejection` events and sends a small beacon to
 * `/api/client-error/`, which forwards it to Sentry server-side (no client
 * Sentry SDK, no CSP `connect-src` change - the browser only talks to our own
 * origin). Mirrors `web-vitals-reporter`:
 *
 * - **skipped on localhost** so `pnpm start` / preview and Playwright / Lighthouse
 *   never emit beacons;
 * - `sendBeacon` runs off the main thread, so it never delays anything;
 * - **deduped + capped** (a render loop must not fire hundreds of beacons): the
 *   same message is sent once, and at most `MAX_REPORTS` per page load.
 */
const MAX_REPORTS = 5;

export function ClientErrorReporter() {
  useEffect(() => {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return;
    if (!navigator.sendBeacon) return;

    const seen = new Set<string>();
    let sent = 0;

    const send = (payload: Record<string, unknown>, dedupeKey: string) => {
      if (sent >= MAX_REPORTS || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      sent += 1;
      try {
        navigator.sendBeacon(
          "/api/client-error/",
          JSON.stringify({ ...payload, url: location.pathname }),
        );
      } catch {
        // sendBeacon is best-effort; never surface an error from error-reporting.
      }
    };

    const onError = (e: ErrorEvent) => {
      const message = e.message || "Unknown error";
      send(
        {
          kind: "error",
          message,
          source: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error instanceof Error ? e.error.stack : undefined,
        },
        `error:${message}:${e.lineno}:${e.colno}`,
      );
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      send(
        {
          kind: "unhandledrejection",
          message,
          stack: reason instanceof Error ? reason.stack : undefined,
        },
        `rejection:${message}`,
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
