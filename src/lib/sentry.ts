import { getCloudflareContext } from "@opennextjs/cloudflare";
import { env } from "~/env";

/**
 * Minimal, dependency-free server-side error capture for the Worker.
 *
 * Instead of pulling in `@sentry/*` (which would mean wrapping the OpenNext-
 * generated `worker.js` - flagged as high-risk in CLAUDE.md), we POST a single
 * Sentry "envelope" straight to the ingest API via `fetch`. That is enough to
 * make a Worker exception show up as an issue in the Sentry project, which the
 * health collector (`crawlers/health/sentry.py`) then counts for the dashboard's
 * Issues tile.
 *
 * Design mirrors `src/lib/indexnow.ts`: fired via `ctx.waitUntil` so it never
 * blocks the response, fully fail-soft, and a NO-OP when `SENTRY_DSN` is unset
 * (so deploying the code exposes/does nothing until a DSN is provisioned with
 * `wrangler secret put SENTRY_DSN`). This is SERVER-side only - the browser
 * never talks to Sentry, so no CSP `connect-src` change is needed. Client-side
 * (browser) Sentry + tracing are deliberately out of scope.
 */

export interface ParsedDsn {
  host: string;
  projectId: string;
  publicKey: string;
  /** The envelope ingest endpoint derived from the DSN. */
  ingestUrl: string;
}

/**
 * Parse a Sentry DSN (`https://<publicKey>@<host>/<projectId>`, optionally with
 * a legacy `:<secret>` in the userinfo). Returns null for anything malformed -
 * the caller then simply does not report (never throws). Pure + unit-tested.
 */
export function parseDsn(dsn: string | undefined | null): ParsedDsn | null {
  if (!dsn) return null;
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const publicKey = url.username;
  // Path is "/<projectId>" (Sentry cloud) - take the last non-empty segment.
  const projectId = url.pathname.split("/").filter(Boolean).pop() ?? "";
  if (!publicKey || !projectId || !url.host) return null;
  const ingestUrl =
    `${url.protocol}//${url.host}/api/${projectId}/envelope/` +
    `?sentry_key=${publicKey}&sentry_version=7`;
  return { host: url.host, projectId, publicKey, ingestUrl };
}

export interface SentryEventInput {
  eventId: string; // 32 hex chars, no dashes
  timestamp: number; // unix seconds
  environment: string;
  error: unknown;
  context?: Record<string, string>;
}

interface SentryEvent {
  event_id: string;
  timestamp: number;
  platform: "javascript";
  level: "error";
  environment: string;
  exception: { values: { type: string; value: string }[] };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/** Build the Sentry event payload from an error + context. Pure. */
export function buildEvent(input: SentryEventInput): SentryEvent {
  const { error, context } = input;
  const type = error instanceof Error ? error.name || "Error" : "UnknownError";
  const value =
    error instanceof Error ? error.message : String(error).slice(0, 1000);
  const event: SentryEvent = {
    event_id: input.eventId,
    timestamp: input.timestamp,
    platform: "javascript",
    level: "error",
    environment: input.environment,
    exception: { values: [{ type, value }] },
  };
  if (context && Object.keys(context).length > 0) event.tags = context;
  if (error instanceof Error && error.stack) {
    event.extra = { stack: error.stack.slice(0, 4000) };
  }
  return event;
}

/**
 * Serialize an event into the newline-delimited Sentry envelope format:
 *   {envelope header}\n{item header}\n{event payload}\n
 * Pure - `sentAt` is passed in so the output is deterministic for tests.
 */
export function buildEnvelope(event: SentryEvent, sentAt: string): string {
  const header = JSON.stringify({ event_id: event.event_id, sent_at: sentAt });
  const itemHeader = JSON.stringify({ type: "event" });
  const payload = JSON.stringify(event);
  return `${header}\n${itemHeader}\n${payload}\n`;
}

/**
 * Report a server-side error to Sentry (no-op without `SENTRY_DSN`). Never
 * throws, never blocks: it fires the POST inside `ctx.waitUntil` when a
 * Cloudflare context is available, else best-effort awaits with a short timeout.
 * `context` becomes Sentry tags (e.g. `{ route: "api/health" }`).
 */
export async function captureServerError(
  error: unknown,
  context?: Record<string, string>,
): Promise<void> {
  const parsed = parseDsn(env.SENTRY_DSN);
  if (!parsed) return;

  const nowMs = Date.now();
  const event = buildEvent({
    eventId: crypto.randomUUID().replace(/-/g, ""),
    timestamp: Math.floor(nowMs / 1000),
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    error,
    context,
  });
  const body = buildEnvelope(event, new Date(nowMs).toISOString());

  const send = async (): Promise<void> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      await fetch(parsed.ingestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-sentry-envelope" },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    } catch (err) {
      // Error reporting must never surface an error itself.
      console.warn("Sentry capture failed:", err);
    }
  };

  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(send());
  } catch {
    // No Cloudflare context (build/test) - best-effort direct send.
    await send();
  }
}
