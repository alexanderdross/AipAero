import { test, expect } from "@playwright/test";

// User-facing flow smoke tests: the search box, the language switcher, and
// graceful 404s. These run against the empty-D1 `next start` server, so they
// assert interaction/navigation wiring rather than airport search results
// (which need a live database).

test("search input on /de/vfr/ is present and accepts input", async ({
  page,
}) => {
  await page.goto("/de/vfr/");
  const input = page.locator('input[name="search"]');
  await expect(input).toBeVisible();
  // Hidden fields carry the query context to the server action.
  await expect(page.locator('input[name="type"]')).toHaveValue("vfr");
  await expect(page.locator('input[name="country"]')).toHaveValue("de");

  await input.fill("EDD");
  await expect(input).toHaveValue("EDD");
});

test("language switcher navigates from /de/ to the English variant", async ({
  page,
}) => {
  await page.goto("/de/");

  // The locale switcher is a Radix Select; the desktop trigger is the visible
  // combobox (the mobile-menu copy is display:none on desktop widths).
  const trigger = page.locator('[role="combobox"]:visible').first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  // Two options: native (German) then English. Pick English (the second).
  const options = page.getByRole("option");
  await expect(options).toHaveCount(2);
  await options.nth(1).click();

  await page.waitForURL(/\/de\/en\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("unknown path under a valid locale returns 404", async ({ page }) => {
  const res = await page.goto("/de/this-route-does-not-exist/");
  expect(res?.status()).toBe(404);
});
