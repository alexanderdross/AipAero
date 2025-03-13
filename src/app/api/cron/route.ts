import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { crawlAt } from "~/lib/crawlers/crawl-at";
import { crawlDe } from "~/lib/crawlers/crawl-de";
import { crawlNl } from "~/lib/crawlers/crawl-nl";
import { crawlUk } from "~/lib/crawlers/crawl-uk";
import { tryCatch } from "~/lib/try-catch";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run all crawlers in parallel
    const response = await Promise.all([
      tryCatch(crawlAt()),
      tryCatch(crawlDe()),
      tryCatch(crawlNl()),
      tryCatch(crawlUk())
    ]);
    for (const result of response) {
      const { error } = result;
      if (error) {
        console.error(error);
      }
    }
    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    let message = 'An unknown error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ message: message }, { status: 500 });
  }
}