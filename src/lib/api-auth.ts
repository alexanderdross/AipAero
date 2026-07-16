// Auth + CORS helpers for the public read-only data API (`/api/v1/*`).
//
// The API offers AIP:Aero's structured aerodrome data to integration partners
// (EFB / flight-planning vendors), advertised on the Pilot-Tools page. It is
// **key-gated**: a partner is issued the shared Bearer token (`PUBLIC_API_KEY`,
// a Worker secret). When the secret is unset the API is treated as not
// configured (503) so the endpoints are inert until a key is provisioned - a
// deploy without the secret exposes nothing.

/** CORS for the public data API: any origin, GET only, Authorization header. */
export const API_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

/**
 * Pure authorization check for a public-API request. Returns `null` when the
 * request is authorized, or `{ status, error }` describing the refusal:
 *  - 503 when no key is configured (the API is inert / not provisioned),
 *  - 401 when the Bearer token is missing or wrong.
 *
 * Kept pure (no env / request access) so it is unit-testable; the route reads
 * `env.PUBLIC_API_KEY` and the `Authorization` header and passes them in.
 */
export function apiKeyError(
  authHeader: string | null,
  configuredKey: string | undefined,
): { status: number; error: string } | null {
  if (!configuredKey) {
    return { status: 503, error: "API not configured" };
  }
  if (authHeader !== `Bearer ${configuredKey}`) {
    return { status: 401, error: "Unauthorized" };
  }
  return null;
}
