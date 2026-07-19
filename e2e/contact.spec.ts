import { test, expect } from "@playwright/test";

// Contact-form ICAO prefill. An airport detail page's "report a problem" link
// sends the reader to the contact form with the aerodrome reference in the
// query (`/contact/?icao=EDNY`, `/de/kontakt/?icao=EDDF`, or `?ref=<slug>` for
// an ICAO-less field). The page reads + sanitizes it and pre-fills the ICAO
// input plus a language-appropriate subject and message.
//
// The e2e server sets the always-pass Turnstile test key (playwright.config.ts)
// so the form renders its fields instead of the "unavailable" fallback.

test.describe("contact form ICAO prefill", () => {
  test("English page pre-fills the ICAO input and subject", async ({
    page,
  }) => {
    await page.goto("/contact/?icao=EDNY", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#contact-icao")).toHaveValue("EDNY");
    await expect(page.locator("#contact-subject")).toHaveValue(
      "Data correction: EDNY",
    );
    await expect(page.locator("#contact-message")).toHaveValue(/EDNY/);
  });

  test("German page pre-fills with German subject copy", async ({ page }) => {
    await page.goto("/de/kontakt/?icao=eddf", {
      waitUntil: "domcontentloaded",
    });
    // Lower-case input is normalized to the upper-case ICAO.
    await expect(page.locator("#contact-icao")).toHaveValue("EDDF");
    await expect(page.locator("#contact-subject")).toHaveValue(
      "Datenkorrektur: EDDF",
    );
  });

  test("ICAO-less field falls back to the ?ref slug in the subject", async ({
    page,
  }) => {
    await page.goto("/contact/?ref=some-helipad", {
      waitUntil: "domcontentloaded",
    });
    // No ICAO, so the input stays empty but the subject still names the field.
    await expect(page.locator("#contact-icao")).toHaveValue("");
    await expect(page.locator("#contact-subject")).toHaveValue(
      "Data correction: SOME-HELIPAD",
    );
  });

  test("a plain visit (no reference) leaves the ICAO input empty", async ({
    page,
  }) => {
    await page.goto("/contact/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#contact-icao")).toHaveValue("");
    await expect(page.locator("#contact-subject")).toHaveValue("");
  });

  test("a junk ICAO param is rejected (no prefill)", async ({ page }) => {
    await page.goto("/contact/?icao=NOT_AN_ICAO", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("#contact-icao")).toHaveValue("");
    await expect(page.locator("#contact-subject")).toHaveValue("");
  });
});

test.describe("footer contact link", () => {
  test("points at the internal contact page, not dross.net", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const link = page.locator("footer a", { hasText: /^Contact$/ });
    await expect(link).toHaveAttribute("href", "/contact/");
    // And it actually resolves (the reported bug: it used to leave the site).
    await link.click();
    await expect(page).toHaveURL(/\/contact\/$/);
    await expect(page.locator("#contact-icao")).toBeVisible();
  });
});
