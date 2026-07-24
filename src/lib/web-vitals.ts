/**
 * Pure validation for the first-party Web-Vitals beacon (`/api/vitals`). Kept out
 * of the route so the bounds/allow-list are unit-testable. The client reporter
 * (`~/components/web-vitals-reporter`) sends this shape via `navigator.sendBeacon`
 * on page hide; the route logs the sanitized object to Workers observability
 * (no DB - queryable first-party field data per URL). Everything is bounded so a
 * forged beacon cannot bloat the logs.
 */

import { type InsertAnalytics } from "~/server/db/schema";

/** The Core Web Vitals (+ FCP/TTFB) we accept, in milliseconds (CLS is unitless). */
export const VITALS_METRICS = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;

export interface Vitals {
  /** Same-origin pathname the sample was collected on. */
  url: string;
  /** Allow-listed metric -> value (bounded, rounded). */
  metrics: Partial<Record<(typeof VITALS_METRICS)[number], number>>;
  /** Navigation type (navigate / reload / back_forward), if reported. */
  nav?: string;
  /** Effective connection type (4g / 3g / ...), if reported. */
  conn?: string;
}

export function sanitizeVitals(raw: unknown): Vitals | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const url = typeof o.url === "string" ? o.url.slice(0, 256) : null;
  if (!url || !url.startsWith("/")) return null; // same-origin path only

  const metricsIn =
    o.metrics && typeof o.metrics === "object"
      ? (o.metrics as Record<string, unknown>)
      : {};
  const metrics: Vitals["metrics"] = {};
  for (const k of VITALS_METRICS) {
    const v = metricsIn[k];
    // 0 <= v < 1h guards against negatives / NaN / absurd forged values.
    if (
      typeof v === "number" &&
      Number.isFinite(v) &&
      v >= 0 &&
      v < 3_600_000
    ) {
      metrics[k] = Math.round(v * 1000) / 1000;
    }
  }
  if (Object.keys(metrics).length === 0) return null;

  const nav = typeof o.nav === "string" ? o.nav.slice(0, 32) : undefined;
  const conn = typeof o.conn === "string" ? o.conn.slice(0, 16) : undefined;
  return { url, metrics, ...(nav ? { nav } : {}), ...(conn ? { conn } : {}) };
}

/**
 * Flatten a sanitized {@link Vitals} beacon into one persisted analytics row
 * (wide format: one column per CWV metric, one row per page view). Pure + typed
 * so the beacon -> DB-row mapping is unit-testable and stays in lockstep with the
 * `analytics` table shape. `recordedAt` is server-stamped by the caller, never
 * taken from the client. Unreported metrics stay `null`.
 */
export function vitalsToAnalyticsRow(
  v: Vitals,
  recordedAt: number,
): InsertAnalytics {
  return {
    recordedAt,
    url: v.url,
    lcp: v.metrics.LCP ?? null,
    cls: v.metrics.CLS ?? null,
    inp: v.metrics.INP ?? null,
    fcp: v.metrics.FCP ?? null,
    ttfb: v.metrics.TTFB ?? null,
    nav: v.nav ?? null,
    conn: v.conn ?? null,
  };
}
