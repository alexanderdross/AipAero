import { test, expect } from "@playwright/test";

// The breadcrumb bar is server-rendered by the pages (bottom of the content,
// above the footer): visible trail and BreadcrumbList JSON-LD come from one
// data structure. These tests run against the empty-D1 `next start` server,
// so they cover the base pages (?ICAO detail crumbs need a database row).

test("breadcrumb links are in the raw SSR HTML of the static list page", async ({
  page,
}) => {
  // Fetch the document directly - no hydration involved. The former client
  // breadcrumb (useSearchParams) never appeared in the prerendered HTML of
  // the static pages at all.
  const res = await page.request.get("/de/flughafen-liste-deutschland/");
  const html = await res.text();
  expect(html).toMatch(/<nav[^>]*aria-label="Brotkrümelnavigation"/);
  expect(html).toContain('"@type":"BreadcrumbList"');
});

test("breadcrumb trail: links, localized labels and aria-current", async ({
  page,
}) => {
  await page.goto("/de/vfr/");
  const nav = page.getByRole("navigation", { name: "Brotkrümelnavigation" });
  await expect(nav).toBeVisible();

  // Root and country level are links; the current page is a plain span.
  await expect(nav.getByRole("link", { name: "AIP Index" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    nav.getByRole("link", { name: "Deutschland (Deutsch)" }),
  ).toHaveAttribute("href", "/de/");
  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveText("VFR");
  await expect(nav.getByRole("link", { name: "VFR" })).toHaveCount(0);
});

test("terms page now carries BreadcrumbList JSON-LD", async ({ page }) => {
  const res = await page.request.get("/de/terms/");
  const html = await res.text();
  expect(html).toContain('"@type":"BreadcrumbList"');
  expect(html).toMatch(/<nav[^>]*aria-label="Brotkrümelnavigation"/);
});
