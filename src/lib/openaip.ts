import "server-only";

import { env } from "~/env";
import { mapOpenAipItem } from "~/lib/openaip-parse";
import type { NormalizedFacts } from "~/lib/airport-facts";

// OpenAIP core API client. Per-ICAO lookup, cached, fully fail-soft: no key, a
// non-OK response, malformed JSON or a timeout all yield `null` so the facts
// card simply falls back to the OurAirports / AWC data (or renders nothing).
// The payload -> NormalizedFacts mapping (field names + enum values from the
// authoritative v1 schema) lives in `~/lib/openaip-parse` and is unit-tested.

const API = "https://api.core.openaip.net/api/airports";
const REVALIDATE = 60 * 60 * 24 * 7; // 7 days - facts change rarely
const TIMEOUT_MS = 2500;

export async function getOpenAipFacts(
  icao: string,
): Promise<NormalizedFacts | null> {
  const key = env.OPENAIP_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${API}?search=${icao}&limit=1`, {
      headers: { "x-openaip-api-key": key },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const items = (json as { items?: unknown[] })?.items;
    const item = (Array.isArray(items) ? items[0] : undefined) as
      | Record<string, unknown>
      | undefined;
    if (!item || item.icaoCode !== icao) return null;
    return mapOpenAipItem(item);
  } catch {
    return null;
  }
}
