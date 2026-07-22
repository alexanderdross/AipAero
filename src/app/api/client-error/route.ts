import { sanitizeClientError } from "~/lib/client-error";
import { captureServerError } from "~/lib/sentry";

/**
 * First-party client-error beacon sink. The client reporter
 * (`~/components/client-error-reporter`) POSTs a small JSON body via
 * `navigator.sendBeacon` on a window `error` / `unhandledrejection`; we validate
 * + bound it and forward it to Sentry through `captureServerError` (a no-op
 * without `SENTRY_DSN`, so nothing leaves the Worker until a DSN is set). Always
 * 204s (fail-soft): a beacon must never surface an error, and a malformed/forged
 * body is simply dropped.
 *
 * No auth (public beacon, like `/api/vitals`); everything is size-bounded by
 * `sanitizeClientError`. Browser -> our own origin, so no CSP change.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const err = sanitizeClientError(await request.json());
    if (err) {
      // Rebuild a lightweight Error so Sentry groups by kind + message and keeps
      // the client stack. Context values must be strings.
      const e = new Error(err.message);
      e.name =
        err.kind === "unhandledrejection"
          ? "UnhandledRejection"
          : "ClientError";
      if (err.stack) e.stack = err.stack;
      const context: Record<string, string> = {
        source: "client",
        kind: err.kind,
        url: err.url,
      };
      if (err.source) context.script = err.source;
      if (err.lineno !== undefined) context.lineno = String(err.lineno);
      if (err.colno !== undefined) context.colno = String(err.colno);
      await captureServerError(e, context);
    }
  } catch {
    // Ignore malformed beacons (sendBeacon bodies are best-effort).
  }
  return new Response(null, { status: 204 });
}
