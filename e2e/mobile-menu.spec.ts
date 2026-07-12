import { test, expect } from "@playwright/test";

// The mobile navigation is a horizontally scrollable pill bar below the
// sticky header row - plain server-rendered links, always visible (SEO:
// mobile-first indexing sees a real <nav> without any interaction). These
// tests run at a phone viewport against the `next start` server.

test.use({ viewport: { width: 390, height: 844 } });

test("mobile pill nav links are in the raw SSR HTML", async ({ page }) => {
  // Assert against the raw document, before hydration can mount anything.
  const res = await page.request.get("/de/");
  const html = await res.text();
  expect(html).toMatch(
    /<nav[^>]*aria-label="Menü"[^>]*>[\s\S]*flughafen-liste-deutschland/,
  );
});

test("mobile pill nav is visible, marks the active page and navigates", async ({
  page,
}) => {
  await page.goto("/de/");

  // Visible without any interaction (no hamburger, no dialog).
  const nav = page.getByRole("navigation", { name: "Menü" });
  await expect(nav).toBeVisible();
  const links = nav.getByRole("link");
  expect(await links.count()).toBeGreaterThanOrEqual(4);

  // The current page (home) carries aria-current="page".
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);

  // Client-side navigation moves the active marker along.
  await nav.locator("a", { hasText: "VFR" }).first().click();
  await page.waitForURL(/\/de\/vfr\/?$/);
  await expect(nav.locator('a[aria-current="page"]').first()).toHaveAttribute(
    "href",
    /\/de\/vfr\/?$/,
  );
});

test("mobile pill nav is hidden on desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/de/");
  await expect(page.getByRole("navigation", { name: "Menü" })).toBeHidden();
  // The desktop menu carries the links instead.
  await expect(page.locator('header nav a[aria-current="page"]')).toHaveCount(
    1,
  );
});
