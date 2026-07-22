/**
 * Pure validation for the first-party client-error beacon (`/api/client-error`).
 * Kept out of the route so the bounds are unit-testable. The client reporter
 * (`~/components/client-error-reporter`) sends this shape via
 * `navigator.sendBeacon` on a window `error` / `unhandledrejection`; the route
 * forwards the sanitized object to Sentry via `captureServerError` (no-op
 * without `SENTRY_DSN`). Everything is bounded so a forged beacon cannot bloat
 * the forwarded event. First-party (browser -> our own origin), so no CSP
 * `connect-src` change and no client Sentry SDK.
 */

export const CLIENT_ERROR_KINDS = ["error", "unhandledrejection"] as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[number];

export interface ClientError {
  kind: ClientErrorKind;
  message: string;
  /** Same-origin pathname the error occurred on. */
  url: string;
  /** Script URL that raised it, if reported. */
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
}

function boundedString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.length > 0 ? v.slice(0, max) : undefined;
}

function nonNegInt(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? Math.floor(v)
    : undefined;
}

export function sanitizeClientError(raw: unknown): ClientError | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const kind: ClientErrorKind =
    o.kind === "unhandledrejection" ? "unhandledrejection" : "error";

  const message = boundedString(o.message, 500);
  if (!message) return null;

  const url = boundedString(o.url, 256);
  if (!url || !url.startsWith("/")) return null; // same-origin path only

  const source = boundedString(o.source, 256);
  const stack = boundedString(o.stack, 4000);
  const lineno = nonNegInt(o.lineno);
  const colno = nonNegInt(o.colno);

  return {
    kind,
    message,
    url,
    ...(source ? { source } : {}),
    ...(lineno !== undefined ? { lineno } : {}),
    ...(colno !== undefined ? { colno } : {}),
    ...(stack ? { stack } : {}),
  };
}
