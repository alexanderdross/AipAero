import { test, expect, type Page } from "@playwright/test";

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
  // ARIA combobox semantics (collapsed on load, no arrow-key model).
  await expect(input).toHaveAttribute("role", "combobox");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toHaveAttribute("aria-autocomplete", "list");
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

// CLS guard: the search results panel (loading skeleton -> results / "no
// results" note) is an absolutely-positioned OVERLAY, so it must never push the
// content below it (a shift landing after the debounce would fall outside the
// browser's 500ms post-input CLS grace window and score as layout shift). We
// assert a stable in-flow marker (the page footer) does not move in DOCUMENT
// coordinates while the panel opens - measured scroll-independently so
// autofocus/scroll cannot confound it. The empty test DB makes the search
// fail-soft to zero matches, so the localized no-results note renders.
const footerDocY = (page: Page) =>
  page
    .locator("footer")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

test("homepage search panel overlays content without shifting layout", async ({
  page,
}) => {
  await page.goto("/");
  const before = await footerDocY(page);
  await page.locator("#airport-search").fill("zzzznomatch");
  await expect(page.getByText("No airports found")).toBeVisible();
  const after = await footerDocY(page);
  expect(Math.abs(after - before)).toBeLessThan(2);
});

test("per-country search panel overlays content without shifting layout", async ({
  page,
}) => {
  await page.goto("/de/vfr/");
  const before = await footerDocY(page);
  await page.locator('input[name="search"]').fill("zzzznomatch");
  await expect(page.getByText("Keine Flugplätze gefunden")).toBeVisible();
  const after = await footerDocY(page);
  expect(Math.abs(after - before)).toBeLessThan(2);
});
