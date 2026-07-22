import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { captureServerError } from "~/lib/sentry";
import { MUTATIONS, QUERIES } from "~/server/db/queries";
import { healthMetricsApiInsertSchema } from "~/server/db/schema";

/**
 * Health-dashboard ingest + read endpoint (docs/health-dashboard-concept.md).
 *
 * POST: the collector on the Coolify/netcup box (`crawlers/health_collector.py`)
 * and the crawlers' own per-country self-report push a batch of metric samples
 * here. Same Bearer `CRON_SECRET` gate as the other server-to-server routes.
 *
 * GET: the internal dashboard (reached only through the Cloudflare Tunnel, and
 * itself Access-gated) reads recent samples, optionally filtered by category /
 * metric / time window. Same Bearer gate - the dashboard app holds the secret
 * server-side and never exposes it to the browser.
 *
 * Never on a public request path, so the read is uncached and the whole route
 * is fail-soft on the ingest side (a forged/malformed body is a 400/401, never
 * a poisoned cache).
 */
export const dynamic = "force-dynamic";

// Optional retention-prune trigger: the collector may POST `?prune=1` on its
// last write of a run to drop rows past the retention window. Absolute cutoff
// (unix seconds) can be given as `?olderThan=`; otherwise the mutation defaults
// to 90 days. Kept off the read/user path.
function unauthorized(req: NextRequest): NextResponse | null {
  if (req.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    console.info(`Unauthorized /api/health request from IP ${ip}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = unauthorized(req);
  if (denied) return denied;

  try {
    const rows = healthMetricsApiInsertSchema.parse(await req.json());

    let inserted = 0;
    if (rows.length > 0) {
      inserted = await MUTATIONS.insertHealthMetrics(rows);
    }

    // Optional retention prune on the same call (collector's last write).
    if (req.nextUrl.searchParams.get("prune") === "1") {
      const olderThanRaw = req.nextUrl.searchParams.get("olderThan");
      const olderThan = olderThanRaw ? Number(olderThanRaw) : undefined;
      await MUTATIONS.pruneHealthMetrics(
        Number.isFinite(olderThan) ? olderThan : undefined,
      );
    }

    return NextResponse.json(
      { message: `Inserted ${inserted} health metrics`, inserted },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error("Validation error", error.issues);
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 },
      );
    }
    console.error(
      error instanceof Error ? error.message : "An unknown error occurred",
    );
    void captureServerError(error, { route: "api/health", method: "POST" });
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const denied = unauthorized(req);
  if (denied) return denied;

  try {
    const p = req.nextUrl.searchParams;
    const sinceRaw = p.get("since");
    const limitRaw = p.get("limit");
    const since = sinceRaw ? Number(sinceRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const metrics = await QUERIES.healthMetrics({
      since: Number.isFinite(since) ? since : undefined,
      category: p.get("category") ?? undefined,
      metric: p.get("metric") ?? undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json(
      { count: metrics.length, metrics },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error(
      error instanceof Error ? error.message : "An unknown error occurred",
    );
    void captureServerError(error, { route: "api/health", method: "GET" });
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
