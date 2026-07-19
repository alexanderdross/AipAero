"use client";

import { useEffect } from "react";

/**
 * First-party Core-Web-Vitals reporter. Renders nothing. Collects LCP, CLS, INP
 * (+ FCP / TTFB) with the native `PerformanceObserver` (no `web-vitals` library
 * - keeps the bundle tiny) and sends ONE beacon on page hide via
 * `navigator.sendBeacon('/api/vitals', ...)`.
 *
 * Web-Vitals-safe by construction:
 * - passive observers (`buffered: true` retrieves the entries that occurred
 *   before hydration, so attaching after hydration loses nothing);
 * - `sendBeacon` runs off the main thread during `pagehide`, so it never
 *   competes with interaction/paint and cannot delay unload;
 * - **skipped on localhost** (like the service worker) so `pnpm start` / preview
 *   and the Playwright + Lighthouse CI runs never emit beacons.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return;
    if (!("PerformanceObserver" in window) || !navigator.sendBeacon) return;

    let lcp = 0;
    let cls = 0;
    let inp = 0;
    const observers: PerformanceObserver[] = [];

    const observe = (
      type: string,
      cb: (entry: PerformanceEntry) => void,
      opts: PerformanceObserverInit = {},
    ) => {
      try {
        const po = new PerformanceObserver((list) =>
          list.getEntries().forEach(cb),
        );
        po.observe({ type, buffered: true, ...opts });
        observers.push(po);
      } catch {
        // Entry type unsupported in this browser - skip that metric.
      }
    };

    // LCP: the largest reported so far (final value = last entry).
    observe("largest-contentful-paint", (e) => {
      lcp = e.startTime;
    });
    // CLS: sum of layout shifts not caused by recent input.
    observe("layout-shift", (e) => {
      const s = e as PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      };
      if (!s.hadRecentInput) cls += s.value;
    });
    // INP (approx): the worst interaction latency observed.
    observe(
      "event",
      (e) => {
        if (e.duration > inp) inp = e.duration;
      },
      { durationThreshold: 40 } as PerformanceObserverInit,
    );

    let sent = false;
    const report = () => {
      if (sent) return;
      sent = true;
      observers.forEach((o) => o.disconnect());

      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const fcp = performance
        .getEntriesByType("paint")
        .find((p) => p.name === "first-contentful-paint");

      const metrics: Record<string, number> = {};
      const add = (k: string, v: number | undefined) => {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0)
          metrics[k] = v;
      };
      add("LCP", lcp);
      add("CLS", cls);
      add("INP", inp);
      add("FCP", fcp?.startTime);
      add("TTFB", nav?.responseStart);

      const conn = (
        navigator as Navigator & { connection?: { effectiveType?: string } }
      ).connection;
      // Trailing slash: `trailingSlash: true` 308-redirects "/api/vitals", and a
      // beacon body is dropped on the redirect - post straight to the final URL.
      navigator.sendBeacon(
        "/api/vitals/",
        JSON.stringify({
          url: location.pathname,
          metrics,
          nav: nav?.type,
          conn: conn?.effectiveType,
        }),
      );
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") report();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", report, { once: true });

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", report);
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  return null;
}
