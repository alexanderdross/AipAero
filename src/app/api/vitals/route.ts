import { sanitizeVitals } from "~/lib/web-vitals";

/**
 * First-party Web-Vitals beacon sink. The client reporter
 * (`~/components/web-vitals-reporter`) POSTs a small JSON body via
 * `navigator.sendBeacon` on page hide; we validate + bound it and log one
 * structured line to Workers observability (queryable per URL, no DB, no
 * migration). Always 204s (fail-soft): a beacon must never surface an error to
 * the user, and a malformed/forged body is simply dropped.
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
    }
  } catch {
    // Ignore malformed beacons (sendBeacon bodies are best-effort).
  }
  // 204 No Content - sendBeacon ignores the body anyway.
  return new Response(null, { status: 204 });
}
