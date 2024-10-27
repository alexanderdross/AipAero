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
  try {
    await Promise.all([
      crawl_at(),
      crawl_de(),
      crawl_nl(),
      crawl_uk()
    ])
    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    let message = 'An error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ message: message }, { status: 500 });
  }
}