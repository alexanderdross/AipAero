import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { crawl_at } from "~/lib/crawlers/crawl_at";
import { crawl_de } from "~/lib/crawlers/crawl_de";
import { crawl_nl } from "~/lib/crawlers/crawl_nl";
import { crawl_uk } from "~/lib/crawlers/crawl_uk";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const at = await crawl_at();
  const de = await crawl_de();
  const nl = await crawl_nl();
  const uk = await crawl_uk();
  return NextResponse.json({ at, de, nl, uk });
}