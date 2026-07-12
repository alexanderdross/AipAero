import { test, expect } from "@playwright/test";

// The mobile navigation is a native <dialog> bottom sheet whose links are
// server-rendered (SEO: mobile-first indexing must see a real <nav> in the
// HTML, not a portal that mounts on open). These tests run at a phone
// viewport against the `next start` server.

test.use({ viewport: { width: 390, height: 844 } });

test("mobile nav links are in the SSR HTML while the dialog is closed", async ({
  page,
}) => {
  // Assert against the raw document, before hydration can mount anything.
  const res = await page.request.get("/de/");
  const html = await res.text();
  expect(html).toContain("<dialog");
  expect(html).toMatch(/<dialog[^>]*>[\s\S]*flughafen-liste-deutschland/);
});

test("mobile menu opens, marks the active page and closes on navigation", async ({
  page,
}) => {
  await page.goto("/de/");

  const dialog = page.locator("dialog");
  await expect(dialog).toHaveCount(1);
  await expect(dialog).not.toBeVisible();

  // 48px tap target hamburger, localized accessible name.
  await page.getByRole("button", { name: "Menü" }).click();
  await expect(dialog).toBeVisible();

  // The current page (home) carries aria-current="page".
  await expect(dialog.locator('nav a[aria-current="page"]')).toHaveCount(1);

  // Navigating from the menu closes the sheet.
  await dialog.locator("nav a", { hasText: "VFR" }).first().click();
  await page.waitForURL(/\/de\/vfr\/?$/);
  await expect(dialog).not.toBeVisible();

  // On the target page the active marker moved along.
  await page.getByRole("button", { name: "Menü" }).click();
  await expect(
    dialog.locator('nav a[aria-current="page"]').first(),
  ).toHaveAttribute("href", /\/de\/vfr\/?$/);
});

test("mobile menu closes via the close button and ESC", async ({ page }) => {
  await page.goto("/de/");
  const dialog = page.locator("dialog");

  await page.getByRole("button", { name: "Menü" }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("button", { name: "Menü" }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
