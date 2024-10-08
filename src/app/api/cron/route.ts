import { type NextRequest, NextResponse } from "next/server";
import { crawl_at } from "~/lib/crawlers/crawl_at";
import { crawl_nl } from "~/lib/crawlers/crawl_nl";
import { crawl_uk } from "~/lib/crawlers/crawl_uk";

export async function GET(request: NextRequest) {
  const at = await crawl_at();
  const nl = await crawl_nl();
  const uk = await crawl_uk();
  return NextResponse.json({ at, nl, uk });
}