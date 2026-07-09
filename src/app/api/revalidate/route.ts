import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { MUTATIONS } from "~/server/db/queries";
import { countryTypeAvailability } from "~/lib/utils";

// POST /api/revalidate - bust every country's cache tags so the prerendered
// pages regenerate from the live D1.
//
// Why this exists: `next build` has no database, so all static pages (airport
// lists, sitemaps) prerender EMPTY and every deploy seeds that empty HTML into
// the incremental cache. Fresh content normally arrives via the per-country
// `revalidateTag` fired by a crawler POST - but between a deploy and the next
// nightly crawl the lists would stay empty. The CD workflow calls this
// endpoint once after each deploy to close that gap.
//
// Auth: same bearer scheme as POST /api/airports (CRON_SECRET).
export async function POST(req: NextRequest) {
  console.info("POST /api/revalidate called");

  if (req.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    console.info(`Unauthorized request from IP ${ip}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All wired countries (hidden ones included - busting an unused tag is
  // harmless, and a country being enabled must not require touching this).
  const countries = Object.keys(countryTypeAvailability);
  const revalidated = MUTATIONS.revalidateCountries(countries);
  // The aerodrome-facts reads (QUERIES.airportFacts) are cached under their
  // own global tag - bust it too, it suffers the same empty build seeding.
  revalidateTag("airportFacts");
  revalidated.push("airportFacts");
  console.info(`Revalidated tags: ${revalidated.join(", ")}`);

  return NextResponse.json({ revalidated }, { status: 200 });
}
