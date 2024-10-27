import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { crawlAt } from "~/lib/crawlers/crawl-at";
import { crawlDe } from "~/lib/crawlers/crawl-de";
import { crawlNl } from "~/lib/crawlers/crawl-nl";
import { crawlUk } from "~/lib/crawlers/crawl-uk";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // See https://vercel.com/docs/cron-jobs
  if (req.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run all crawlers in parallel
    await Promise.all([
      crawlAt(),
      crawlDe(),
      crawlNl(),
      crawlUk()
    ]);
    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    let message = 'An error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ message: message }, { status: 500 });
  }
}