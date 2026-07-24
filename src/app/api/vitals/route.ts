import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { sanitizeVitals, vitalsToAnalyticsRow } from "~/lib/web-vitals";
import { MUTATIONS, QUERIES } from "~/server/db/queries";

/**
 * First-party Web-Vitals beacon sink + internal read.
 *
 * POST (public beacon): the client reporter (`~/components/web-vitals-reporter`)
 * sends a small JSON body via `navigator.sendBeacon` on page hide. We validate +
 * bound it, log one structured line to Workers observability AND persist it as
 * one row in the dedicated `analytics` table (CWV RUM field data, per page view).
 * The DB write is fired OFF the response path via `ctx.waitUntil` and is
 * fail-soft, so it can never delay the beacon or surface an error. Always 204s;
 * a malformed/forged body is simply dropped.
 *
 * GET (internal, Bearer `CRON_SECRET`): the health dashboard (reached only via
 * the Cloudflare Tunnel, itself Access-gated) reads recent rows for its Vitals
 * tile, optionally filtered by url / time window; `?prune=1` drops rows past the
 * retention window (the collector's run). Never on a public request path, so the
 * read is uncached.
 *
 * Complements Cloudflare Web Analytics (site-level CWV) with FIRST-PARTY,
 * PER-URL field data - so a bad LCP can be traced to the exact page type.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const vitals = sanitizeVitals(await request.json());
    if (vitals) {
      console.log(`web-vitals ${JSON.stringify(vitals)}`);
      // Persist off the critical path: waitUntil lets the 204 return first, and
      // `insertAnalytics` is itself fail-soft, so a DB hiccup never reaches the
      // user. Server-stamp the time so a forged client clock can't skew it.
      const row = vitalsToAnalyticsRow(vitals, Math.floor(Date.now() / 1000));
      try {
        const { ctx } = getCloudflareContext();
        ctx.waitUntil(MUTATIONS.insertAnalytics(row));
      } catch {
        // No Cloudflare context (e.g. build): skip the write, keep the log.
      }
    }
  } catch {
    // Ignore malformed beacons (sendBeacon bodies are best-effort).
  }
  // 204 No Content - sendBeacon ignores the body anyway.
  return new Response(null, { status: 204 });
}

function unauthorized(req: NextRequest): NextResponse | null {
  if (req.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    console.info(`Unauthorized /api/vitals request from IP ${ip}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = unauthorized(req);
  if (denied) return denied;

  try {
    const p = req.nextUrl.searchParams;

    if (p.get("prune") === "1") {
      const olderThanRaw = p.get("olderThan");
      const olderThan = olderThanRaw ? Number(olderThanRaw) : undefined;
      await MUTATIONS.pruneAnalytics(
        Number.isFinite(olderThan) ? olderThan : undefined,
      );
    }

    const sinceRaw = p.get("since");
    const limitRaw = p.get("limit");
    const since = sinceRaw ? Number(sinceRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const rows = await QUERIES.analyticsRecent({
      since: Number.isFinite(since) ? since : undefined,
      url: p.get("url") ?? undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json({ count: rows.length, rows }, { status: 200 });
  } catch (error: unknown) {
    console.error(
      error instanceof Error ? error.message : "An unknown error occurred",
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
