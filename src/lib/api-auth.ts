// Auth + CORS helpers for the public read-only data API (`/api/v1/*`).
//
// The API offers AIP:Aero's structured aerodrome data to integration partners
// (EFB / flight-planning vendors), advertised on the Pilot-Tools page. It is
// **key-gated** with two credential paths:
//  - the shared `PUBLIC_API_KEY` Worker secret = the bootstrap key AND the
//    on/off switch: unset -> the API is inert (503), so a deploy without the
//    secret exposes nothing;
//  - per-partner keys stored (hashed) in the `api_keys` D1 table: each partner
//    gets their own bearer token, so a key can be attributed and revoked
//    without rotating everyone's. Purely additive on top of the bootstrap key.

/** CORS for the public data API: any origin, GET only, Authorization header. */
export const API_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

/**
 * Pure authorization decision for a public-API request. Returns `null` when the
 * request is authorized, or `{ status, error }` describing the refusal:
 *  - 503 when no key is configured (the API is inert / not provisioned),
 *  - `null` when the Bearer equals the bootstrap key OR a per-partner key
 *    matched (`partnerMatched`),
 *  - 401 otherwise (missing / wrong token).
 *
 * Kept pure (no env / DB / request access) so it is unit-testable; the route
 * resolves `env.PUBLIC_API_KEY`, the `Authorization` header, and the per-partner
 * DB lookup, then passes the booleans in. `partnerMatched` defaults to `false`,
 * so the original single-key callers keep their exact behaviour.
 */
export function apiKeyError(
  authHeader: string | null,
  configuredKey: string | undefined,
  partnerMatched = false,
): { status: number; error: string } | null {
  if (!configuredKey) {
    return { status: 503, error: "API not configured" };
  }
  if (authHeader === `Bearer ${configuredKey}`) {
    return null;
  }
  if (partnerMatched) {
    return null;
  }
  return { status: 401, error: "Unauthorized" };
}

/** Extract the raw token from an `Authorization: Bearer <token>` header. Pure. */
export function bearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer (.+)$/.exec(authHeader);
  return m ? m[1]! : null;
}

/** SHA-256 hex of a string via Web Crypto (available on the Workers runtime). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Full async authorization for a public-API route: bootstrap key first (no DB
 * hit), else hash the presented bearer and look it up among the active
 * per-partner keys. Returns the same `{ status, error } | null` as
 * `apiKeyError`. The lookup is fail-soft (a rejected promise -> not matched), so
 * a DB hiccup never turns a bootstrap-key request into a 500.
 */
export async function authorizeApiRequest(
  authHeader: string | null,
  configuredKey: string | undefined,
  lookupActiveKeyHash: (hash: string) => Promise<boolean>,
): Promise<{ status: number; error: string } | null> {
  // Unset key -> inert; bootstrap-key match -> authorized. Both skip the DB.
  if (!configuredKey || authHeader === `Bearer ${configuredKey}`) {
    return apiKeyError(authHeader, configuredKey);
  }
  const token = bearerToken(authHeader);
  let partnerMatched = false;
  if (token) {
    try {
      partnerMatched = await lookupActiveKeyHash(await sha256Hex(token));
    } catch {
      partnerMatched = false;
    }
  }
  return apiKeyError(authHeader, configuredKey, partnerMatched);
}
