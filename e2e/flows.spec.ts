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

  // The locale switcher is two plain links (native + English) in a labelled
  // nav landmark; the current language carries aria-current.
  const switcher = page.getByRole("navigation", { name: "Sprache ändern" });
  await expect(switcher.getByRole("link")).toHaveCount(2);
  await expect(
    switcher.locator("a[aria-current]", { hasText: "Deutsch" }),
  ).toHaveCount(1);

  await switcher.getByRole("link", { name: /English/ }).click();
  await page.waitForURL(/\/de\/en\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("language switcher preserves the valueless ?ICAO airport key", async ({
  page,
}) => {
  // The airport detail scheme is a bare query KEY (?EDNY, no value); the
  // language links must carry it over without re-encoding it as ?EDNY=.
  await page.goto("/de/vfr/?EDNY");
  const switcher = page.getByRole("navigation", { name: "Sprache ändern" });
  await expect(switcher.getByRole("link", { name: /English/ })).toHaveAttribute(
    "href",
    /\/de\/en\/vfr\/\?EDNY$/,
  );
});

test("unknown path under a valid locale returns 404", async ({ page }) => {
  const res = await page.goto("/de/this-route-does-not-exist/");
  expect(res?.status()).toBe(404);
});
