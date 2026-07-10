import { test, expect, type Page } from "@playwright/test";
import { allPages } from "./pages";

// Rendered-output SEO contract. Every indexable page must ship, in the served
// <head> (not streamed into <body>), a unique non-empty meta description plus
// canonical / Open Graph / Twitter tags and exactly one <main> landmark.
//
// This is the guard for the whole class of regressions that shipped green
// through typecheck+lint+build: missing meta description (setRequestLocale
// ordering), <meta> streamed into <body> on dynamic routes (htmlLimitedBots),
// and the missing <main> landmark.

type Meta = {
  status: number | null;
  htmlLang: string | null;
  title: string | null;
  descriptionInHead: string | null;
  descriptionCount: number;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  twitterCard: string | null;
  mainCount: number;
};

async function readMeta(page: Page, path: string): Promise<Meta> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  return {
    status: response?.status() ?? null,
    ...(await page.evaluate(() => {
      const headMeta = (sel: string) =>
        document.head.querySelector<HTMLMetaElement>(sel)?.content ?? null;
      return {
        htmlLang: document.documentElement.getAttribute("lang"),
        title: document.title || null,
        // Only count/read descriptions that live in <head> — a description
        // hoisted into <body> by client JS must NOT satisfy the contract.
        descriptionInHead: headMeta('meta[name="description"]'),
        descriptionCount: document.head.querySelectorAll(
          'meta[name="description"]',
        ).length,
        canonical:
          document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
            ?.href ?? null,
        ogTitle: headMeta('meta[property="og:title"]'),
        ogDescription: headMeta('meta[property="og:description"]'),
        ogImage: headMeta('meta[property="og:image"]'),
        ogUrl: headMeta('meta[property="og:url"]'),
        twitterCard: headMeta('meta[name="twitter:card"]'),
        mainCount: document.querySelectorAll("main").length,
      };
    })),
  };
}

for (const p of allPages) {
  test(`SEO metadata: ${p.label} (${p.path})`, async ({ page }) => {
    const m = await readMeta(page, p.path);

    expect(m.status, "HTTP status").toBe(200);
    expect(m.htmlLang, "<html lang>").toBe(p.lang);

    // Meta description: exactly one, in <head>, non-empty, sensible length.
    expect(m.descriptionCount, "one <meta description> in <head>").toBe(1);
    expect(m.descriptionInHead, "description content").toBeTruthy();
    expect(
      (m.descriptionInHead ?? "").length,
      "description length",
    ).toBeGreaterThanOrEqual(30);
    expect((m.descriptionInHead ?? "").length).toBeLessThanOrEqual(320);

    // Title present.
    expect(m.title, "<title>").toBeTruthy();

    // Canonical + Open Graph + Twitter card all present.
    expect(m.canonical, "canonical URL").toBeTruthy();
    expect(m.ogTitle, "og:title").toBeTruthy();
    expect(m.ogDescription, "og:description").toBeTruthy();
    expect(m.ogImage, "og:image").toBeTruthy();
    expect(m.ogUrl, "og:url").toBeTruthy();
    expect(m.twitterCard, "twitter:card").toBe("summary_large_image");

    // Exactly one <main> landmark (Lighthouse "document has a main landmark").
    expect(m.mainCount, "exactly one <main>").toBe(1);
  });
}

test("meta descriptions are unique across pages", async ({ page }) => {
  // Visits every page in the matrix in one test; with the terms pages the
  // matrix is 80+ pages, which outgrew the default 30s timeout.
  test.slow();
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const p of allPages) {
    const m = await readMeta(page, p.path);
    const desc = m.descriptionInHead ?? "";
    if (seen.has(desc)) {
      dupes.push(`"${desc}" shared by ${seen.get(desc)} and ${p.path}`);
    } else {
      seen.set(desc, p.path);
    }
  }
  expect(dupes, `duplicate meta descriptions:\n${dupes.join("\n")}`).toEqual(
    [],
  );
});
