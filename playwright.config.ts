import { defineConfig, devices } from "@playwright/test";

// End-to-end / rendered-output tests. These run against a *production* build
// served by `next start`, because that is the only local server that
// reproduces production behaviour we care about — in particular Next's
// streaming-metadata placement (see next.config.mjs `htmlLimitedBots`). The
// Python crawlers keep their own pytest suite; this is website-only.
//
// The DB is a Cloudflare D1 binding that is absent under `next start`, so
// reads fail-soft to empty results. That is fine here: every page under test
// renders without airport rows (the airport-detail `?ICAO` happy path needs a
// live D1 and is exercised by the deployed Lighthouse run instead).
const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI runs on the memory-constrained self-hosted runner (historic OOM kills):
  // cap the parallel Chromium workers there and allow one extra retry so a
  // transient kill/timeout doesn't fail the whole job. Locally: full speed.
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Allow pointing at a pre-installed Chromium (e.g. a sandbox that
        // pins a different Playwright build). CI leaves this unset and uses
        // the browser from `playwright install`.
        ...(process.env.PW_EXECUTABLE_PATH
          ? {
              launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SKIP_ENV_VALIDATION: "1",
      NODE_ENV: "production",
      CRON_SECRET: "test-secret",
      ADSENSE_ID: "0000000000000000",
      // Cloudflare's documented always-pass Turnstile test site key, so the
      // contact form renders its fields (a production build with no key would
      // instead show the "unavailable" fallback and hide the inputs the
      // contact-prefill test asserts on). The widget script may fail to load
      // offline - that does not affect the fields' presence.
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      PORT: String(PORT),
    },
  },
});
