import { NextRequest, NextResponse } from "next/server";
import { crawl_at } from "~/lib/crawlers/crawl_at";

export async function GET(request: NextRequest) {
  const at = await crawl_at();
  return NextResponse.json({ at });
}