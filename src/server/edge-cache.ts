import "server-only";

// Cloudflare Workers Cache API (per-colo edge cache). Absent on `next dev` /
// `next start` (Node) and during the build, so every access is guarded and
// those environments just run the handler directly.
type EdgeCache = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
};

function edgeCache(): EdgeCache | undefined {
  const store = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return store?.default;
}

/**
 * Serve a GET route-handler response from the Cloudflare edge cache, keyed on
 * the full request URL (query string included - it carries the locale/ICAO
 * variation). On Workers an `s-maxage` in the handler's Cache-Control is NOT
 * honored by the edge on its own: the Worker runs on every request unless the
 * response is explicitly put into the Cache API. A hit skips the handler (and
 * its D1 read / upstream fetches) entirely; the stored entry expires per its
 * own Cache-Control.
 *
 * Only responses that are `ok` AND carry an `s-maxage` are stored - fail-soft
 * fallbacks (which deliberately send no Cache-Control) never get pinned.
 */
export async function withEdgeCache(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const cache = edgeCache();
  if (!cache) return handler();
  const key = new Request(request.url, { method: "GET" });
  try {
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch {
    /* cache unavailable: fall through to the handler */
  }
  const response = await handler();
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  if (response.ok && cacheControl.includes("s-maxage")) {
    try {
      await cache.put(key, response.clone());
    } catch {
      /* not cacheable / quota: serve uncached */
    }
  }
  return response;
}
